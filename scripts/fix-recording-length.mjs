#!/usr/bin/env node
/**
 * Writes the missing length into a recording that was already joined.
 *
 * A MediaRecorder writes WebM as it goes and cannot know how long the recording will be, so the app
 * puts the length into the header while the chunks are joined (`setWebmDuration`). A recording whose
 * tab closed is finished from the meeting's page with "Finish with what was uploaded", and that path
 * **threw the length away** (`finish.partial ? null : …`), so its video went out with no Duration: a
 * player shows no total time and refuses to seek forward. The app no longer does that (the length is
 * read from the video's own timeline when the browser cannot say), but a recording joined before the
 * fix keeps the header it was given. This repairs those.
 *
 * For each recorded meeting whose stored video has no Duration:
 *   - the length is the one on the record, or, when that is null too, the video's own last Cluster
 *     time, read from the end of the object itself;
 *   - the head of the object is rewritten with that length and the rest is **copied inside storage**
 *     (`UploadPartCopy`), so a 300 MB recording is repaired without being downloaded or re-uploaded;
 *   - the record's `recording.durationMs` is filled in, so the page says how long the meeting was.
 *
 * The object is replaced only after the new one has been built and read back, and `--dry-run` only
 * reports. It is safe to run again: a video that already has a length is left alone.
 *
 *   node scripts/fix-recording-length.mjs [--dry-run] [--meeting <id>]
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import mongoose from "mongoose"
import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  UploadPartCopyCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")
const require = createRequire(join(root, "package.json"))

const isDryRun = process.argv.includes("--dry-run")
const meetingArg = process.argv.indexOf("--meeting")
const onlyMeeting = meetingArg === -1 ? null : process.argv[meetingArg + 1]

// S3 refuses a part under 5 MiB, so the rewritten head is sent as one part of at least that
const HEAD_BYTES = 8 * 1024 * 1024
// How much of the end is read to find the recording's own last timecode
const TAIL_BYTES = 4 * 1024 * 1024

function fromEnv(name) {
  for (const file of [".env.local", ".env"]) {
    const path = join(root, file)
    if (!existsSync(path)) continue
    const line = readFileSync(path, "utf8")
      .split(/\r?\n/)
      .find((row) => row.startsWith(`${name}=`))
    if (line) return line.slice(name.length + 1).trim().replace(/^"|"$/g, "")
  }
  if (process.env[name]) return process.env[name]
  throw new Error(`${name} is not set: put it in .env.local or the environment.`)
}

// The app's own reader and writer, so this script can never disagree with what the app does
const jiti = require("jiti")(join(root, "tests/load.mjs"), { alias: { "@": join(root, "src") }, interopDefault: true })
const { lastClusterTimecodeMs, readTimecodeScale, readWebmDuration, setWebmDuration } = jiti(join(root, "src/lib/webmDuration.ts"))

const Bucket = fromEnv("AWS_S3_BUCKET_NAME")
const s3 = new S3Client({
  region: fromEnv("AWS_REGION"),
  credentials: { accessKeyId: fromEnv("AWS_ACCESS_KEY_ID"), secretAccessKey: fromEnv("AWS_SECRET_ACCESS_KEY") },
})

const readRange = async (Key, from, to) => {
  const got = await s3.send(new GetObjectCommand({ Bucket, Key, Range: `bytes=${from}-${to}` }))
  const pieces = []
  for await (const piece of got.Body) pieces.push(piece)
  return Buffer.concat(pieces)
}

const minutes = (ms) => `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`

/** Replaces the object with the same bytes, its head rewritten to carry the length. */
async function writeLengthInto(Key, size, contentType, head) {
  const uploadId = (await s3.send(new CreateMultipartUploadCommand({ Bucket, Key, ContentType: contentType }))).UploadId
  try {
    const parts = [{ PartNumber: 1, ETag: (await s3.send(new UploadPartCommand({ Bucket, Key, UploadId: uploadId, PartNumber: 1, Body: head }))).ETag }]
    // Everything after the head is copied where it already is, so nothing travels over the network
    let at = HEAD_BYTES
    for (let number = 2; at < size; number++) {
      // A copied part may be up to 5 GB; recordings are far smaller, so this is nearly always one
      const to = Math.min(at + 4 * 1024 * 1024 * 1024, size) - 1
      const copied = await s3.send(
        new UploadPartCopyCommand({ Bucket, Key, UploadId: uploadId, PartNumber: number, CopySource: `${Bucket}/${Key}`, CopySourceRange: `bytes=${at}-${to}` })
      )
      parts.push({ PartNumber: number, ETag: copied.CopyPartResult.ETag })
      at = to + 1
    }
    await s3.send(new CompleteMultipartUploadCommand({ Bucket, Key, UploadId: uploadId, MultipartUpload: { Parts: parts } }))
  } catch (error) {
    await s3.send(new AbortMultipartUploadCommand({ Bucket, Key, UploadId: uploadId })).catch(() => undefined)
    throw error
  }
}

async function repair(db, meeting) {
  const id = String(meeting._id)
  const title = meeting.title ?? "(no name)"
  const mimeType = meeting.recording?.tracks?.screen?.mimeType ?? "video/webm"
  if (mimeType !== "video/webm") return console.log(`- ${id} ${title}: not a WebM recording, left alone`)
  const Key = `LinkPilot/meeting-recordings/${id}/screen.webm`

  let size
  let contentType
  try {
    const found = await s3.send(new HeadObjectCommand({ Bucket, Key }))
    size = found.ContentLength
    contentType = found.ContentType ?? mimeType
  } catch {
    return console.log(`- ${id} ${title}: no video in storage, left alone`)
  }

  const head = await readRange(Key, 0, Math.min(HEAD_BYTES, size) - 1)
  const already = readWebmDuration(head)
  if (already) return console.log(`- ${id} ${title}: already ${minutes(already)}, left alone`)

  // The record's own length first; otherwise the video's own timeline, read from its end
  let durationMs = meeting.recording?.durationMs ?? null
  let from = "the record"
  if (!durationMs) {
    const tail = await readRange(Key, Math.max(0, size - TAIL_BYTES), size - 1)
    const found = lastClusterTimecodeMs(tail, readTimecodeScale(head) ?? undefined)
    durationMs = found ? Math.round(found) : null
    from = "the video itself"
  }
  if (!durationMs) return console.log(`- ${id} ${title}: no length could be read, left alone`)

  const written = setWebmDuration(head, durationMs)
  if (!written) return console.log(`- ${id} ${title}: its header cannot carry a length, left alone`)

  console.log(`- ${id} ${title}: ${minutes(durationMs)} from ${from}, ${(size / 1048576).toFixed(0)} MB`)
  if (isDryRun) return

  await writeLengthInto(Key, size, contentType, written)
  const check = readWebmDuration(await readRange(Key, 0, Math.min(1048576, size) - 1))
  if (!check) throw new Error(`${id}: the length did not take; the video is unchanged apart from its header`)
  await db.collection("meetings").updateOne({ _id: meeting._id }, { $set: { "recording.durationMs": durationMs } })
  console.log(`  repaired: the video now says ${minutes(check)}`)
}

async function main() {
  await mongoose.connect(fromEnv("MONGODB_URI"), { serverSelectionTimeoutMS: 20000 })
  const db = mongoose.connection.db
  const filter = { recording: { $ne: null } }
  if (onlyMeeting) filter._id = new mongoose.Types.ObjectId(onlyMeeting)
  const meetings = await db.collection("meetings").find(filter, { projection: { title: 1, recording: 1 } }).toArray()
  const recorded = meetings.filter((meeting) => meeting.recording?.stage === "done")
  console.log(`${recorded.length} finished recording${recorded.length === 1 ? "" : "s"}${isDryRun ? " (dry run, nothing is written)" : ""}`)
  for (const meeting of recorded) {
    try {
      await repair(db, meeting)
    } catch (error) {
      console.error(`- ${String(meeting._id)}: ${error instanceof Error ? error.message : error}`)
    }
  }
  await mongoose.disconnect()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
