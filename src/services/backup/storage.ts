import { UserFacingError } from "@/lib/errors"
import { withRetry } from "@/lib/retry"
import { isTransientError } from "@/lib/transientErrors"
import {
  abortMultipartUpload,
  completeMultipartUpload,
  isStorageConfigured,
  presignDownload,
  putObject,
  startMultipartUpload,
  uploadPartBytes,
} from "@/services/storage/s3"
import { BACKUP_CONTENT_TYPE, BACKUP_MESSAGES, BACKUP_STORAGE_PREFIX, BACKUP_UPLOAD_RETRIES } from "@/constants/backups"
// S3's own rule, not a meeting's: a part of a multipart upload must be at least 5 MiB
import { MULTIPART_MIN_PART_BYTES } from "@/constants/meetingRecording"

/**
 * Where a backup goes in the bucket. The dump arrives a piece at a time and is sent on as soon as
 * enough has gathered to make a part S3 accepts, so a database of any size is stored without ever
 * being held whole: at most one part (5 MiB) is in memory.
 *
 * A dump small enough to be one part is sent as a single object instead, which costs one call.
 * Every call is retried with exponential backoff and jitter on a transient failure (lib/retry.ts),
 * on top of the SDK's own retries, and a part that is waiting in memory can be sent again without
 * reading the database a second time.
 */

export const backupStorageKey = (fileName: string) => `${BACKUP_STORAGE_PREFIX}/${fileName}`

const retryUpload = <T>(what: string, call: () => Promise<T>): Promise<T> =>
  withRetry(call, {
    retries: BACKUP_UPLOAD_RETRIES,
    shouldRetry: isTransientError,
    onRetry: (error, attempt, delayMs) =>
      console.warn(`↻ Backup ${what} failed (${error instanceof Error ? error.message : error}); retry ${attempt} in ${delayMs}ms`),
  })

export interface BackupSink {
  /** Takes the next piece of the dump. */
  write(text: string): Promise<void>
  /** Finishes the file and says where it is and how big it turned out. */
  finish(): Promise<{ storageKey: string | null; sizeBytes: number }>
  /** Throws away an unfinished upload, so a failed backup leaves no parts paying rent. */
  abort(): Promise<void>
}

/** A sink that stores nothing, for a dump that is only being downloaded (or with storage switched off). */
export function countingSink(): BackupSink {
  let sizeBytes = 0
  return {
    async write(text) {
      sizeBytes += Buffer.byteLength(text)
    },
    async finish() {
      return { storageKey: null, sizeBytes }
    },
    async abort() {},
  }
}

/** The backup put in the bucket under its own name. Throws when storage isn't configured. */
export function uploadSink(fileName: string): BackupSink {
  if (!isStorageConfigured()) throw new UserFacingError(BACKUP_MESSAGES.storageUnavailable)
  const key = backupStorageKey(fileName)
  let waiting: Buffer[] = []
  let waitingBytes = 0
  let sizeBytes = 0
  let uploadId: string | null = null
  let partNumber = 0

  // Everything gathered so far, sent as the next part of a multipart upload
  const sendPart = async () => {
    const body = Buffer.concat(waiting)
    waiting = []
    waitingBytes = 0
    uploadId ??= await retryUpload("upload start", () => startMultipartUpload(key, BACKUP_CONTENT_TYPE))
    partNumber += 1
    const number = partNumber
    await retryUpload(`part ${number}`, () => uploadPartBytes(key, uploadId as string, number, body))
  }

  return {
    async write(text) {
      const piece = Buffer.from(text)
      waiting.push(piece)
      waitingBytes += piece.byteLength
      sizeBytes += piece.byteLength
      // Only whole parts go now; the rest waits, since S3 refuses a part under the minimum
      while (waitingBytes >= MULTIPART_MIN_PART_BYTES) await sendPart()
    },
    async finish() {
      if (uploadId === null) {
        // Small enough to be one object, so it never becomes a multipart upload at all
        await retryUpload("upload", () => putObject(key, Buffer.concat(waiting), BACKUP_CONTENT_TYPE))
        waiting = []
        waitingBytes = 0
        return { storageKey: key, sizeBytes }
      }
      // The last part may be under the minimum, which S3 allows
      if (waitingBytes > 0) await sendPart()
      await retryUpload("upload finish", () => completeMultipartUpload(key, uploadId as string))
      return { storageKey: key, sizeBytes }
    },
    async abort() {
      waiting = []
      waitingBytes = 0
      if (uploadId !== null) await abortMultipartUpload(key, uploadId)
    },
  }
}

/** A short-lived link that downloads one stored backup under its own file name. */
export function backupDownloadLink(storageKey: string, fileName: string): Promise<string> {
  if (!isStorageConfigured()) throw new UserFacingError(BACKUP_MESSAGES.storageUnavailable)
  return presignDownload(storageKey, BACKUP_CONTENT_TYPE, fileName)
}
