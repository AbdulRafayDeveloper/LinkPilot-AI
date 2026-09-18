import { RECORDING_STORAGE_PREFIX, baseMimeType } from "@/constants/meetingRecording"

/**
 * The arithmetic of a recording's chunks, kept apart from the browser and the database so it can be
 * tested on its own (`tests/meetingRecording.test.mjs`): how a growing recording is cut into chunks
 * no bigger than the upload ceiling, which chunks are joined into each S3 part, and where each piece
 * is kept in the bucket.
 */

/**
 * Cuts what has been recorded so far into chunks of exactly `maxBytes`, keeping the remainder for the
 * next cut. The stream is one continuous file, so it can be cut at any byte: joined back in order, the
 * chunks are the recording exactly as it was made.
 */
export function cutChunks(recorded: Blob, maxBytes: number): { chunks: Blob[]; rest: Blob } {
  const chunks: Blob[] = []
  let offset = 0
  while (recorded.size - offset >= maxBytes) {
    chunks.push(recorded.slice(offset, offset + maxBytes))
    offset += maxBytes
  }
  return { chunks, rest: recorded.slice(offset) }
}

/**
 * Which chunks make up each part of the joined file: runs of consecutive chunks of at least
 * `minPartBytes` each, which S3 needs for every part but the last. `from` is inclusive, `to` exclusive.
 */
export function groupIntoParts(sizes: readonly number[], minPartBytes: number): { from: number; to: number; bytes: number }[] {
  const parts: { from: number; to: number; bytes: number }[] = []
  let from = 0
  let bytes = 0
  sizes.forEach((size, index) => {
    bytes += size
    if (bytes >= minPartBytes) {
      parts.push({ from, to: index + 1, bytes })
      from = index + 1
      bytes = 0
    }
  })
  if (from < sizes.length) parts.push({ from, to: sizes.length, bytes })
  return parts
}

/** How many chunks there are from 0 with none missing, which is how much of a recording is usable. */
export function contiguousCount(chunks: Record<string, number>): number {
  let count = 0
  while (typeof chunks[String(count)] === "number") count++
  return count
}

// The file extension for a stored type
const extensionOf = (mimeType: string) => {
  const base = baseMimeType(mimeType)
  if (base.endsWith("/mp4")) return base.startsWith("audio") ? "m4a" : "mp4"
  if (base.endsWith("/ogg")) return "ogg"
  return "webm"
}

const padded = (index: number) => String(index).padStart(6, "0")

/** Where the pieces of one meeting's recording live. Every key is built here, on the server, from the meeting's own id. */
export const recordingKeys = {
  chunk: (meetingId: string, track: string, index: number, mimeType: string) =>
    `${RECORDING_STORAGE_PREFIX}/${meetingId}/${track}/chunk-${padded(index)}.${extensionOf(mimeType)}`,
  final: (meetingId: string, track: string, mimeType: string) => `${RECORDING_STORAGE_PREFIX}/${meetingId}/${track}.${extensionOf(mimeType)}`,
  audio: (meetingId: string, index: number, mimeType: string) =>
    `${RECORDING_STORAGE_PREFIX}/${meetingId}/audio/${padded(index)}.${extensionOf(mimeType)}`,
}

/** "1:05:09" or "5:09", for the time markers in a recording's transcript. */
export function formatOffset(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = String(total % 60).padStart(2, "0")
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`
}
