import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { toUserFacingMessage } from "@/lib/errors"
import { allOf, createdBetween, searchCondition } from "@/lib/listQuery"
import { isStorageConfigured } from "@/services/storage/s3"
import { BackupLogModel, type IBackupLog } from "@/models/BackupLog"
import { HISTORY_PAGE_SIZE } from "@/constants/historyFilters"
import { BACKUP_ERROR_MAX_LENGTH, BACKUP_MESSAGES, type BackupStatus, type BackupTrigger } from "@/constants/backups"
import { backupFileName, dumpDatabase, type DumpCounts } from "./dump"
import { backupDownloadLink, countingSink, uploadSink, type BackupSink } from "./storage"
import type { BackupLogEntry, BackupSummary, BackupsPage } from "@/types/backups"

/**
 * Backing the database up, and the record of every run.
 *
 * One flow serves both ways in: the weekly schedule (Vercel Cron calls the route, which checks
 * CRON_SECRET) and the admin's own button, which streams the same dump to the browser as a file
 * while the copy goes to the bucket. Either way the run ends with a record saying what happened,
 * so a failure is something the admin can read rather than something that vanished.
 *
 * Reading the database to write it out never changes anything in it, and the records live in their
 * own collection, so nothing here touches what the rest of the app stores.
 */

type StoredLog = IBackupLog & { _id: { toString: () => string } }

const shorten = (reason: unknown) => {
  const text = reason instanceof Error ? reason.message : String(reason)
  return text.slice(0, BACKUP_ERROR_MAX_LENGTH)
}

export const toBackupEntry = (record: StoredLog): BackupLogEntry => ({
  id: record._id.toString(),
  createdAt: new Date(record.createdAt).toISOString(),
  finishedAt: record.finishedAt ? new Date(record.finishedAt).toISOString() : null,
  status: record.status,
  trigger: record.trigger,
  fileName: record.fileName,
  // The key itself never leaves the server; the page only needs to know a file is there to download
  hasFile: Boolean(record.storageKey),
  sizeBytes: record.sizeBytes ?? null,
  collections: record.collections ?? null,
  documents: record.documents ?? null,
  durationMs: record.finishedAt ? new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime() : null,
  errorMessage: record.errorMessage ?? null,
  startedBy: record.startedBy ?? null,
})

interface RunRecord {
  status: BackupStatus
  trigger: BackupTrigger
  startedAt: Date
  fileName: string
  storageKey: string | null
  sizeBytes: number | null
  counts: DumpCounts
  errorMessage: string | null
  startedBy: string | null
}

/** Writes the record of one run. A record that can't be written is logged, never thrown at the caller. */
async function recordRun(run: RunRecord): Promise<BackupLogEntry | null> {
  try {
    await connectDatabase()
    const record = await BackupLogModel.create({
      status: run.status,
      trigger: run.trigger,
      startedAt: run.startedAt,
      finishedAt: new Date(),
      fileName: run.fileName,
      storageKey: run.storageKey,
      sizeBytes: run.sizeBytes,
      collections: run.counts.collections,
      documents: run.counts.documents,
      errorMessage: run.errorMessage,
      startedBy: run.startedBy,
    })
    return toBackupEntry(record.toObject() as unknown as StoredLog)
  } catch (error: unknown) {
    console.error("Backup Record Exception:", error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * The whole database written out and put in the bucket, which is what the weekly schedule runs.
 * It always answers with the record of the attempt: a failed upload is recorded and returned
 * rather than thrown, so the schedule's own call still succeeds and the reason is on the page.
 */
export async function runBackup(options: { trigger: BackupTrigger; startedBy?: string | null }): Promise<BackupLogEntry | null> {
  const startedAt = new Date()
  const fileName = backupFileName(startedAt)
  const counts: DumpCounts = { collections: 0, documents: 0 }
  let sink: BackupSink | null = null
  try {
    sink = uploadSink(fileName)
    for await (const piece of dumpDatabase(counts)) await sink.write(piece)
    const { storageKey, sizeBytes } = await sink.finish()
    console.log(`Backup stored: ${fileName} (${counts.collections} collections, ${counts.documents} documents, ${sizeBytes} bytes)`)
    return recordRun({ status: "success", trigger: options.trigger, startedAt, fileName, storageKey, sizeBytes, counts, errorMessage: null, startedBy: options.startedBy ?? null })
  } catch (error: unknown) {
    console.error("Backup Exception:", error instanceof Error ? error.message : error)
    await sink?.abort().catch(() => undefined)
    return recordRun({
      status: "failed",
      trigger: options.trigger,
      startedAt,
      fileName,
      storageKey: null,
      sizeBytes: null,
      counts,
      errorMessage: toUserFacingMessage(error, shorten(error)),
      startedBy: options.startedBy ?? null,
    })
  }
}

/**
 * The same backup, streamed to the browser as a file to keep while the copy goes to the bucket.
 * Nothing is written to disk on the server: each piece is handed to the browser and to the upload
 * as it is made.
 *
 * **A storage problem never costs the download.** If the bucket is not configured, or the upload
 * fails part way, the stream carries on to the end and the record says the cloud copy did not land.
 */
export function backupDownloadStream(startedBy: string | null): { fileName: string; body: ReadableStream<Uint8Array> } {
  const startedAt = new Date()
  const fileName = backupFileName(startedAt)
  const counts: DumpCounts = { collections: 0, documents: 0 }
  let bytes = 0
  let uploadProblem: string | null = null
  let sink: BackupSink

  if (isStorageConfigured()) {
    try {
      sink = uploadSink(fileName)
    } catch (error: unknown) {
      sink = countingSink()
      uploadProblem = toUserFacingMessage(error, shorten(error))
    }
  } else {
    sink = countingSink()
    uploadProblem = BACKUP_MESSAGES.storageUnavailable
  }

  // Once the cloud copy has failed there is nothing left to send it to, so only the download goes on
  const giveUpOnUpload = async (error: unknown) => {
    uploadProblem = shorten(error)
    console.warn(`Backup upload failed, the download carries on: ${uploadProblem}`)
    await sink.abort().catch(() => undefined)
    sink = countingSink()
  }

  const pieces = dumpDatabase(counts)
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await pieces.next()
        if (!done) {
          const chunk = Buffer.from(value)
          bytes += chunk.byteLength
          controller.enqueue(new Uint8Array(chunk))
          await sink.write(value).catch(giveUpOnUpload)
          return
        }
        const stored = await sink.finish().catch(async (error: unknown) => {
          await giveUpOnUpload(error)
          return { storageKey: null as string | null, sizeBytes: bytes }
        })
        await recordRun({
          status: uploadProblem ? "failed" : "success",
          trigger: "manual",
          startedAt,
          fileName,
          storageKey: stored.storageKey,
          sizeBytes: bytes,
          counts,
          errorMessage: uploadProblem,
          startedBy,
        })
        controller.close()
      } catch (error: unknown) {
        // The dump itself failed, so the file the browser has is incomplete and the record says why
        console.error("Backup Export Exception:", error instanceof Error ? error.message : error)
        await sink.abort().catch(() => undefined)
        await recordRun({
          status: "failed",
          trigger: "manual",
          startedAt,
          fileName,
          storageKey: null,
          sizeBytes: bytes,
          counts,
          errorMessage: toUserFacingMessage(error, shorten(error)),
          startedBy,
        })
        controller.error(error)
      }
    },
    async cancel() {
      // The browser stopped the download: the upload goes with it, and nothing is recorded as done
      await sink.abort().catch(() => undefined)
      await pieces.return(undefined).catch(() => undefined)
    },
  })
  return { fileName, body }
}

export interface BackupFilters {
  page: number
  search: string
  status: BackupStatus | ""
  trigger: BackupTrigger | ""
  from: string | null
  to: string | null
}

/** Exactly the records the filters cover, so the list and a count can never disagree. */
const matchingFilter = (filters: Omit<BackupFilters, "page">) =>
  allOf([
    searchCondition(filters.search, ["fileName", "errorMessage", "startedBy"]),
    filters.status ? { status: filters.status } : null,
    filters.trigger ? { trigger: filters.trigger } : null,
    createdBetween(filters.from, filters.to),
  ])

async function summarize(): Promise<BackupSummary> {
  const [total, succeeded, failed, newest] = await Promise.all([
    BackupLogModel.countDocuments({}),
    BackupLogModel.countDocuments({ status: "success" }),
    BackupLogModel.countDocuments({ status: "failed" }),
    BackupLogModel.findOne({ status: "success" }, { createdAt: 1 }).sort({ createdAt: -1 }).lean(),
  ])
  const last = newest as { createdAt?: Date } | null
  return { total, succeeded, failed, lastSuccessAt: last?.createdAt ? new Date(last.createdAt).toISOString() : null }
}

/**
 * One page of backup records, newest first, 50 to a page. A page past the end comes back as the
 * last page, so a filter that leaves fewer records never shows an empty screen. Admin only; the
 * route checks the role.
 */
export async function listBackups(filters: BackupFilters): Promise<BackupsPage> {
  await connectDatabase()
  const pageSize = HISTORY_PAGE_SIZE
  const matching = matchingFilter(filters)
  const [total, summary] = await Promise.all([BackupLogModel.countDocuments(matching), summarize()])
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, filters.page), totalPages)
  const records = (await BackupLogModel.find(matching)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean()) as unknown as StoredLog[]
  return { items: records.map(toBackupEntry), page, pageSize, total, totalPages, summary }
}

/** A link that downloads one stored backup, or null when the record or its file is gone. */
export async function linkToBackup(id: string): Promise<string | null> {
  if (!/^[0-9a-f]{24}$/.test(id)) return null
  await connectDatabase()
  const record = (await BackupLogModel.findById(new mongoose.Types.ObjectId(id), { storageKey: 1, fileName: 1 }).lean()) as
    | { storageKey?: string | null; fileName?: string }
    | null
  if (!record?.storageKey) return null
  return backupDownloadLink(record.storageKey, record.fileName ?? "backup.json")
}
