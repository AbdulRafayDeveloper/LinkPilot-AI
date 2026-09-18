import { z } from "zod"
import {
  MEETING_NOTES_MAX_LENGTH,
  MAX_RECORDING_CHUNKS,
  RECORDING_CHUNK_MAX_BYTES,
  RECORDING_MESSAGES,
  STORED_AUDIO_TYPES,
  STORED_VIDEO_TYPES,
  UPLOAD_TRACKS,
  baseMimeType,
} from "@/constants/meetingRecording"
import { MEETING_MESSAGES, MEETING_TITLE_MAX_LENGTH } from "@/constants/meetings"

/**
 * What the recording routes accept. Sizes and indexes are bounded here; whether a chunk really
 * arrived, and how big it really is, is checked against S3 by the service.
 */

const oneOf = (allowed: readonly string[]) => z.string().max(100).refine((mimeType) => allowed.includes(baseMimeType(mimeType)), "That recording format isn't supported.")

export const CreateRecordingSchema = z.object({
  title: z.string().trim().max(MEETING_TITLE_MAX_LENGTH, MEETING_MESSAGES.titleTooLong).optional(),
  screenMime: oneOf(STORED_VIDEO_TYPES),
  cameraMime: oneOf(STORED_VIDEO_TYPES).optional(),
  audioMime: oneOf(STORED_AUDIO_TYPES),
})

const track = z.enum(UPLOAD_TRACKS)
const index = z.number().int().min(0).max(MAX_RECORDING_CHUNKS - 1)

/**
 * Which chunk the body of a PUT is: its track, its place, and for an audio piece where it starts in the
 * recording. Read from the query string, since the body is the chunk's own bytes.
 */
export const ChunkQuerySchema = z.object({
  track,
  index: z.coerce.number().pipe(index),
  startMs: z.coerce.number().int().min(0).max(24 * 3600 * 1000).optional(),
})

/** The bytes of one chunk: never empty, never over 4 MB. */
export const chunkSizeIssue = (size: number): string | null =>
  size === 0 ? RECORDING_MESSAGES.chunkMissing : size > RECORDING_CHUNK_MAX_BYTES ? RECORDING_MESSAGES.chunkTooLarge : null

const count = z.number().int().min(0).max(MAX_RECORDING_CHUNKS)

/** How the recording ended: with every chunk counted, or `partial` for one whose page closed. */
export const FinishRecordingSchema = z.object({
  durationMs: z.number().int().min(0).max(24 * 3600 * 1000).optional(),
  counts: z.object({ screen: count.optional(), camera: count.optional(), audio: count.optional() }).optional(),
  partial: z.boolean().optional(),
})

export const MeetingNotesSchema = z.object({
  notes: z.string().max(MEETING_NOTES_MAX_LENGTH, `Keep the notes under ${MEETING_NOTES_MAX_LENGTH.toLocaleString()} characters.`),
})
