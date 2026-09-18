import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { Meeting as MeetingModel } from "@/models/Meeting"
import {
  completeMultipartUpload,
  deleteObject,
  getObjectBytes,
  headObject,
  isStorageConfigured,
  presignDownload,
  putObject,
  startMultipartUpload,
  abortMultipartUpload,
  uploadPartBytes,
} from "@/services/storage/s3"
import { isGroqTranscriptionConfigured } from "@/services/ai"
import { transcribeRecording } from "@/services/transcribeAudio"
import { detectAudioMimeType } from "@/lib/audioType"
import { setWebmDuration } from "@/lib/webmDuration"
import { contiguousCount, formatOffset, groupIntoParts, recordingKeys } from "@/lib/recordingParts"
import { countChunks, hashTranscript } from "@/lib/transcriptChunks"
import {
  MULTIPART_MIN_PART_BYTES,
  RECORDING_CHUNK_MAX_BYTES,
  RECORDING_MESSAGES,
  RECORDING_STEP_BUDGET_MS,
  RECORDING_TRACKS,
  SEGMENTS_PER_STEP,
  baseMimeType,
  type RecordingTrackId,
  type UploadTrackId,
} from "@/constants/meetingRecording"
import { VOICE_MESSAGES } from "@/constants/voiceInput"
import { MEETING_MESSAGES } from "@/constants/meetings"
import type {
  MeetingRecordingLinks,
  MeetingRecordingSummary,
  RecordingStepState,
  StoredAudioSegment,
  StoredRecording,
  StoredRecordingTrack,
} from "@/types/meetingRecording"
import type { Viewer } from "@/types/auth"
import { visibleById } from "@/services/auth/viewer"

/**
 * A meeting recorded in the app, from the first chunk to the transcript.
 *
 * 1. **Recording** (`createRecordedMeeting`, `storeChunk`): the meeting is saved first, then every chunk
 *    the browser records is sent to the app's own route, which puts it in S3 and records it in the same
 *    request. A chunk is at most 4 MB, which is what keeps it under Vercel's 4.5 MB request body limit,
 *    and it goes through the app rather than straight to the bucket so it works from any origin: the
 *    bucket's CORS rule only lets a browser upload from the origins listed in it.
 * 2. **Finishing** (`finishRecording`): the browser says how many chunks it made; every one of them
 *    must be confirmed, so nothing recorded is left out. A recording whose tab closed can be finished
 *    with what did arrive (`partial`).
 * 3. **Joining and writing out** (`runRecordingStep`): short steps, each well inside a function's time
 *    limit, called again by the page while there is more. The chunks of each video are joined into one
 *    file through a multipart upload whose parts the server assembles (S3 refuses parts under 5 MiB,
 *    so two 4 MB chunks make one part), with the recording's length written into its header so it can
 *    be seeked. Then each audio piece is written out by Whisper on Groq, never OpenAI. When the last
 *    piece is done the transcript goes on the meeting and the ordinary analysis takes over.
 *
 * Every step records where it got to on the meeting, so a step that is cut off, or a failure, is picked
 * up again exactly there.
 */

type StoredMeeting = { _id: mongoose.Types.ObjectId; title: string; recording: unknown }

const recordingOf = (meeting: { recording: unknown }) => meeting.recording as StoredRecording | null

const chunkSizes = (track: StoredRecordingTrack, total: number) => Array.from({ length: total }, (_unused, index) => track.chunks[String(index)] ?? 0)

const sumOf = (values: number[]) => values.reduce((total, value) => total + value, 0)

const segmentsOf = (recording: StoredRecording) =>
  Object.entries(recording.audio?.segments ?? {})
    .map(([index, segment]) => ({ index: Number(index), ...segment }))
    .sort((a, b) => a.index - b.index)

/** What the page may know about a recording: progress and bytes, never a key. */
export function toRecordingSummary(recording: StoredRecording): MeetingRecordingSummary {
  let joinedDone = 0
  let joinedTotal = 0
  for (const trackId of RECORDING_TRACKS) {
    const track = recording.tracks[trackId]
    if (!track) continue
    const total = track.total ?? contiguousCount(track.chunks)
    joinedTotal += total
    if (track.finalKey) joinedDone += total
    else joinedDone += groupIntoParts(chunkSizes(track, total), MULTIPART_MIN_PART_BYTES).slice(0, Math.max(0, track.nextPart - 1)).reduce((sum, part) => sum + (part.to - part.from), 0)
  }
  const segments = segmentsOf(recording)
  const uploaded = (trackId: RecordingTrackId) => sumOf(Object.values(recording.tracks[trackId]?.chunks ?? {}))
  return {
    stage: recording.stage,
    startedAt: recording.startedAt,
    durationMs: recording.durationMs,
    hasCamera: Boolean(recording.tracks.camera),
    uploadedBytes: { screen: uploaded("screen"), camera: uploaded("camera"), audio: sumOf(segments.map((segment) => segment.size)) },
    joined: { done: joinedDone, total: joinedTotal },
    transcribed: { done: segments.filter((segment) => segment.text !== null).length, total: segments.length },
    error: recording.error,
  }
}

const emptyTrack = (mimeType: string): StoredRecordingTrack => ({ mimeType, chunks: {}, total: null, uploadId: null, nextPart: 1, finalKey: null, finalSize: 0 })

/** Saves the meeting a recording goes into, before a single byte is recorded, so every chunk has somewhere to go. */
export async function createRecordedMeeting(
  viewer: Viewer,
  input: { title?: string; screenMime: string; cameraMime?: string; audioMime: string }
): Promise<{ id: string; recording: MeetingRecordingSummary }> {
  if (!isStorageConfigured()) throw new UserFacingError(RECORDING_MESSAGES.storageUnavailable)
  await connectDatabase()
  const named = (input.title ?? "").trim()
  const recording: StoredRecording = {
    stage: "recording",
    startedAt: new Date().toISOString(),
    stoppedAt: null,
    durationMs: null,
    tracks: {
      screen: emptyTrack(baseMimeType(input.screenMime)),
      ...(input.cameraMime ? { camera: emptyTrack(baseMimeType(input.cameraMime)) } : {}),
    },
    audio: { mimeType: baseMimeType(input.audioMime), segments: {} },
    error: null,
  }
  const record = await MeetingModel.create({
    ownerId: viewer.id,
    // Until the analysis writes a real title from what was said
    title: named || "Recorded meeting",
    isTitleGenerated: named === "",
    status: "recording",
    recording,
  })
  return { id: record._id.toString(), recording: toRecordingSummary(recording) }
}

async function recordingFor(viewer: Viewer, id: string): Promise<{ meeting: StoredMeeting; recording: StoredRecording } | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const meeting = (await MeetingModel.findOne(filter, { title: 1, recording: 1 }).lean()) as unknown as StoredMeeting | null
  const recording = meeting ? recordingOf(meeting) : null
  return meeting && recording ? { meeting, recording } : null
}

// The type a track's chunks are stored and signed with
function mimeFor(recording: StoredRecording, track: UploadTrackId): string | null {
  if (track === "audio") return recording.audio.mimeType
  return recording.tracks[track]?.mimeType ?? null
}

function keyFor(meetingId: string, recording: StoredRecording, track: UploadTrackId, index: number): string | null {
  const mimeType = mimeFor(recording, track)
  if (!mimeType) return null
  return track === "audio" ? recordingKeys.audio(meetingId, index, mimeType) : recordingKeys.chunk(meetingId, track, index, mimeType)
}

/**
 * Keeps one chunk: its bytes go to S3 under a key built here from the meeting's own id, and the chunk is
 * recorded on the meeting with the size that was really stored. Sending the same chunk twice stores the
 * same bytes under the same key, so a retry is harmless. Only while the meeting is still being recorded.
 */
export async function storeChunk(
  viewer: Viewer,
  id: string,
  chunk: { track: UploadTrackId; index: number; startMs?: number },
  bytes: Buffer
): Promise<boolean | null> {
  if (bytes.length === 0) throw new UserFacingError(RECORDING_MESSAGES.chunkMissing)
  if (bytes.length > RECORDING_CHUNK_MAX_BYTES) throw new UserFacingError(RECORDING_MESSAGES.chunkTooLarge)
  const found = await recordingFor(viewer, id)
  if (!found) return null
  if (found.recording.stage !== "recording") throw new UserFacingError(RECORDING_MESSAGES.notRecording)
  const key = keyFor(id, found.recording, chunk.track, chunk.index)
  const contentType = mimeFor(found.recording, chunk.track)
  if (!key || !contentType) return null
  await putObject(key, bytes, contentType)
  const stored = { size: bytes.length }
  const path =
    chunk.track === "audio"
      ? {
          [`recording.audio.segments.${chunk.index}`]: {
            size: stored.size,
            mimeType: found.recording.audio.mimeType,
            startMs: Math.max(0, chunk.startMs ?? 0),
            text: null,
          } satisfies StoredAudioSegment,
        }
      : { [`recording.tracks.${chunk.track}.chunks.${chunk.index}`]: stored.size }
  // Only while it is still recording: a chunk can never land in a recording that has moved on
  const { matchedCount } = await MeetingModel.updateOne({ _id: found.meeting._id, "recording.stage": "recording" }, { $set: path })
  if (matchedCount === 0) {
    // The meeting was deleted, or stopped recording, while this chunk was on its way. A delete clears
    // only the files it knows about, and this one wasn't recorded yet, so nothing would ever remove it:
    // it goes now, rather than part of a deleted meeting staying in storage
    await deleteObject(key).catch(() => undefined)
    if (!(await MeetingModel.exists({ _id: found.meeting._id }))) return null
    throw new UserFacingError(RECORDING_MESSAGES.notRecording)
  }
  return true
}

/**
 * Stops taking chunks and starts joining and writing out. With `counts`, every chunk the browser made
 * must already be confirmed (otherwise 409: some are still on their way). With `partial`, for a
 * recording whose page closed, it keeps what arrived: each video up to its first missing chunk, and
 * every audio piece that landed.
 */
export async function finishRecording(
  viewer: Viewer,
  id: string,
  finish: { durationMs?: number; counts?: Partial<Record<UploadTrackId, number>>; partial?: boolean }
): Promise<MeetingRecordingSummary | null> {
  const found = await recordingFor(viewer, id)
  if (!found) return null
  const { recording } = found
  // Finishing twice answers with where it is now
  if (recording.stage !== "recording") return toRecordingSummary(recording)

  const totals: Partial<Record<RecordingTrackId, number>> = {}
  for (const trackId of RECORDING_TRACKS) {
    const track = recording.tracks[trackId]
    if (!track) continue
    const confirmed = contiguousCount(track.chunks)
    const expected = finish.partial ? confirmed : (finish.counts?.[trackId] ?? 0)
    if (!finish.partial && confirmed < expected) throw new UserFacingError(RECORDING_MESSAGES.stillUploading)
    totals[trackId] = expected
  }
  if (!finish.partial) {
    const expectedAudio = finish.counts?.audio ?? 0
    const missing = Array.from({ length: expectedAudio }, (_unused, index) => index).filter((index) => !recording.audio.segments[String(index)])
    if (missing.length > 0) throw new UserFacingError(RECORDING_MESSAGES.stillUploading)
  }

  const nothing = (totals.screen ?? 0) === 0 && Object.keys(recording.audio.segments).length === 0
  const set: Record<string, unknown> = {
    "recording.stoppedAt": new Date().toISOString(),
    "recording.durationMs": finish.partial ? null : (finish.durationMs ?? null),
    "recording.stage": nothing ? "failed" : "consolidating",
    "recording.error": nothing ? RECORDING_MESSAGES.nothingUploaded : null,
    status: nothing ? "failed" : "transcribing",
    statusMessage: nothing ? RECORDING_MESSAGES.nothingUploaded : null,
  }
  for (const [trackId, total] of Object.entries(totals)) set[`recording.tracks.${trackId}.total`] = total
  const updated = (await MeetingModel.findOneAndUpdate({ _id: found.meeting._id, "recording.stage": "recording" }, { $set: set }, { returnDocument: "after" }).lean()) as unknown as StoredMeeting | null
  const now = updated ? recordingOf(updated) : null
  return now ? toRecordingSummary(now) : null
}

// ---------- Joining the chunks ----------

async function removeObjects(keys: string[]): Promise<void> {
  const queue = [...keys]
  const worker = async () => {
    for (let key = queue.shift(); key; key = queue.shift()) await deleteObject(key).catch(() => undefined)
  }
  await Promise.all(Array.from({ length: Math.min(5, keys.length) }, worker))
}

/**
 * Joins one video's chunks into its finished file, as far as the deadline allows. Answers true once the
 * file is complete. Every part sent is recorded before the next, so a step cut off mid-way resends at
 * most one part.
 */
async function joinTrack(meetingId: string, trackId: RecordingTrackId, track: StoredRecordingTrack, durationMs: number | null, deadline: number): Promise<boolean> {
  const total = track.total ?? 0
  // Records progress on the meeting, answering whether the meeting is still there to record it on
  const set = async (fields: Record<string, unknown>) =>
    (
      await MeetingModel.updateOne(
        { _id: new mongoose.Types.ObjectId(meetingId) },
        { $set: Object.fromEntries(Object.entries(fields).map(([key, value]) => [`recording.tracks.${trackId}.${key}`, value])) }
      )
    ).matchedCount > 0
  /**
   * The meeting was deleted while its video was being put together. The delete has already cleared
   * the files it knew about, so what this step has just written (the finished file, or an upload
   * still open) has nothing left pointing at it: it is removed here, and the step stops.
   */
  const deletedMeanwhile = async (cleanUp: () => Promise<unknown>): Promise<never> => {
    await cleanUp().catch(() => undefined)
    throw new UserFacingError(MEETING_MESSAGES.notFound)
  }
  if (total === 0) {
    await set({ finalKey: null, finalSize: 0, nextPart: 1 })
    return true
  }
  const finalKey = recordingKeys.final(meetingId, trackId, track.mimeType)
  const parts = groupIntoParts(chunkSizes(track, total), MULTIPART_MIN_PART_BYTES)
  const isWebm = track.mimeType === "video/webm"

  const assemble = async (part: { from: number; to: number }, first: boolean): Promise<Buffer> => {
    const pieces: Buffer[] = []
    for (let index = part.from; index < part.to; index++) {
      const bytes = await getObjectBytes(recordingKeys.chunk(meetingId, trackId, index, track.mimeType))
      if (!bytes) throw new UserFacingError(`Chunk ${index + 1} of the ${trackId} recording is missing from storage.`)
      pieces.push(bytes)
    }
    const joined = Buffer.concat(pieces)
    // The length goes into the header, which is in the first chunk, so the finished file can be seeked
    return first && isWebm && durationMs ? (setWebmDuration(joined, durationMs) ?? joined) : joined
  }

  if (parts.length === 1) {
    const bytes = await assemble(parts[0], true)
    await putObject(finalKey, bytes, track.mimeType)
    if (!(await set({ finalKey, finalSize: bytes.length, nextPart: 2 }))) await deletedMeanwhile(() => deleteObject(finalKey))
  } else {
    const uploadId = track.uploadId ?? (await startMultipartUpload(finalKey, track.mimeType))
    const abandon = () => abortMultipartUpload(finalKey, uploadId)
    if (!track.uploadId && !(await set({ uploadId, nextPart: 1 }))) await deletedMeanwhile(abandon)
    for (let partNumber = track.nextPart; partNumber <= parts.length; partNumber++) {
      if (Date.now() > deadline) return false
      await uploadPartBytes(finalKey, uploadId, partNumber, await assemble(parts[partNumber - 1], partNumber === 1))
      if (!(await set({ nextPart: partNumber + 1 }))) await deletedMeanwhile(abandon)
    }
    try {
      await completeMultipartUpload(finalKey, uploadId)
    } catch (error: unknown) {
      // A step cut off right after completing leaves the file done and the upload gone: that is finished too
      if (!(await headObject(finalKey))) throw error
    }
    if (!(await set({ finalKey, finalSize: (await headObject(finalKey))?.size ?? 0, uploadId: null }))) await deletedMeanwhile(() => deleteObject(finalKey))
  }
  // The finished file is what is kept; the chunks it was made of go
  await removeObjects(Array.from({ length: total }, (_unused, index) => recordingKeys.chunk(meetingId, trackId, index, track.mimeType)))
  return true
}

// ---------- Writing out the audio ----------

/** One audio piece written out by Groq. Silence is an empty text, not a failure. */
async function transcribeSegment(meetingId: string, index: number, segment: StoredAudioSegment, signal: AbortSignal): Promise<string> {
  const bytes = await getObjectBytes(recordingKeys.audio(meetingId, index, segment.mimeType), signal)
  const mimeType = bytes ? detectAudioMimeType(bytes) : null
  if (!bytes || !mimeType) return ""
  try {
    // Whisper on Groq only: this module never sends a recording to OpenAI
    const { text } = await transcribeRecording({ audio: { data: bytes, mimeType }, signal, providers: ["groq"] })
    return text
  } catch (error: unknown) {
    if (error instanceof UserFacingError && error.message === VOICE_MESSAGES.unclearAudio) return ""
    throw error
  }
}

function joinTranscript(recording: StoredRecording): string {
  return segmentsOf(recording)
    .filter((segment) => segment.text?.trim())
    .map((segment) => `[${formatOffset(segment.startMs)}] ${segment.text?.trim()}`)
    .join("\n\n")
}

/**
 * Moves one recording forward by one short step: joining, then writing out, then handing the transcript
 * to the analysis. Answers where it got to and whether there is more; a failure is recorded on the
 * meeting and the next call carries on from it.
 */
export async function runRecordingStep(id: string, signal: AbortSignal): Promise<RecordingStepState | null> {
  await connectDatabase()
  const meetingId = new mongoose.Types.ObjectId(id)
  const load = async () => {
    const meeting = (await MeetingModel.findById(meetingId, { title: 1, recording: 1 }).lean()) as unknown as StoredMeeting | null
    return meeting ? recordingOf(meeting) : null
  }
  let recording = await load()
  if (!recording) return null
  const answer = (hasMore: boolean): RecordingStepState => ({ recording: toRecordingSummary(recording as StoredRecording), hasMore })
  if (recording.stage === "recording" || recording.stage === "done") return answer(false)

  const deadline = Date.now() + RECORDING_STEP_BUDGET_MS
  try {
    if (recording.stage === "failed") {
      // A failure is picked up where it happened: joining if any video isn't finished, otherwise writing out
      const joining = RECORDING_TRACKS.some((trackId) => recording?.tracks[trackId] && !recording.tracks[trackId]?.finalKey && (recording.tracks[trackId]?.total ?? 0) > 0)
      await MeetingModel.updateOne({ _id: meetingId }, { $set: { "recording.stage": joining ? "consolidating" : "transcribing", "recording.error": null, status: "transcribing", statusMessage: null } })
      recording = (await load()) as StoredRecording
    }

    if (recording.stage === "consolidating") {
      for (const trackId of RECORDING_TRACKS) {
        const track = recording.tracks[trackId]
        if (!track || track.finalKey || (track.total ?? 0) === 0) continue
        if (!(await joinTrack(id, trackId, track, recording.durationMs, deadline))) {
          recording = (await load()) as StoredRecording
          return answer(true)
        }
      }
      await MeetingModel.updateOne({ _id: meetingId }, { $set: { "recording.stage": "transcribing" } })
      recording = (await load()) as StoredRecording
      // Writing out starts in the next call, so joining and writing out never share one step's time
      return answer(true)
    }

    if (recording.stage === "transcribing") {
      const pending = segmentsOf(recording).filter((segment) => segment.text === null)
      if (pending.length > 0 && !isGroqTranscriptionConfigured()) throw new UserFacingError(RECORDING_MESSAGES.transcriptionUnavailable)
      for (const segment of pending.slice(0, SEGMENTS_PER_STEP)) {
        if (Date.now() > deadline) break
        const text = await transcribeSegment(id, segment.index, segment, signal)
        await MeetingModel.updateOne({ _id: meetingId }, { $set: { [`recording.audio.segments.${segment.index}.text`]: text } })
      }
      recording = (await load()) as StoredRecording
      if (segmentsOf(recording).some((segment) => segment.text === null)) return answer(true)

      const transcript = joinTranscript(recording)
      if (!transcript) throw new UserFacingError(RECORDING_MESSAGES.noSpeech)
      // The transcript goes on the meeting and the ordinary analysis takes it from here ("saved")
      await MeetingModel.updateOne(
        { _id: meetingId },
        {
          $set: {
            transcript,
            transcriptChars: transcript.length,
            transcriptHash: hashTranscript(transcript),
            totalChunks: countChunks(transcript),
            analyzedChunks: 0,
            status: "saved",
            statusMessage: null,
            "recording.stage": "done",
            "recording.error": null,
          },
        }
      )
      recording = (await load()) as StoredRecording
    }
    return answer(false)
  } catch (error: unknown) {
    if (signal.aborted) throw error
    const message = (error instanceof UserFacingError ? error.message : RECORDING_MESSAGES.processFailed).slice(0, 300)
    console.error("Meeting recording step failed:", JSON.stringify({ id, message: error instanceof Error ? error.message.slice(0, 200) : String(error) }))
    await MeetingModel.updateOne({ _id: meetingId }, { $set: { "recording.stage": "failed", "recording.error": message, status: "failed", statusMessage: message } })
    recording = (await load()) as StoredRecording
    return answer(false)
  }
}

/** Signed links to play and download what was recorded. Every link expires; the bucket stays private. */
export async function recordingLinks(viewer: Viewer, id: string): Promise<MeetingRecordingLinks | null> {
  const found = await recordingFor(viewer, id)
  if (!found) return null
  const { recording, meeting } = found
  const screen = recording.tracks.screen
  const camera = recording.tracks.camera
  const fileName = `${meeting.title.replace(/[^\w .-]+/g, "").trim() || "meeting"}.${screen?.mimeType === "video/mp4" ? "mp4" : "webm"}`
  return {
    screen: screen?.finalKey
      ? {
          url: await presignDownload(screen.finalKey, screen.mimeType),
          downloadUrl: await presignDownload(screen.finalKey, screen.mimeType, fileName),
          mimeType: screen.mimeType,
          size: screen.finalSize,
        }
      : null,
    camera: camera?.finalKey ? { url: await presignDownload(camera.finalKey, camera.mimeType), mimeType: camera.mimeType } : null,
    audio: await Promise.all(
      segmentsOf(recording).map(async (segment) => ({
        url: await presignDownload(recordingKeys.audio(id, segment.index, segment.mimeType), segment.mimeType),
        startMs: segment.startMs,
      }))
    ),
  }
}

/**
 * Every object a recording may have in storage, and any multipart upload still open, so deleting the
 * meeting (or its account) leaves nothing behind. Built from what the meeting recorded, never by
 * listing the bucket.
 */
export function recordingStorage(meetingId: string, stored: unknown): { keys: string[]; uploads: { key: string; uploadId: string }[] } {
  const recording = stored as StoredRecording | null
  if (!recording) return { keys: [], uploads: [] }
  const keys: string[] = []
  const uploads: { key: string; uploadId: string }[] = []
  for (const trackId of RECORDING_TRACKS) {
    const track = recording.tracks?.[trackId]
    if (!track) continue
    // Missing, not empty, on a track that hasn't sent a chunk yet (an empty object isn't saved)
    for (const index of Object.keys(track.chunks ?? {})) keys.push(recordingKeys.chunk(meetingId, trackId, Number(index), track.mimeType))
    const finalKey = recordingKeys.final(meetingId, trackId, track.mimeType)
    keys.push(finalKey)
    if (track.uploadId) uploads.push({ key: finalKey, uploadId: track.uploadId })
  }
  for (const segment of segmentsOf(recording)) keys.push(recordingKeys.audio(meetingId, segment.index, segment.mimeType))
  return { keys, uploads }
}

/**
 * Removes a deleted meeting's recording from storage. The recording is an attachment of the meeting, so
 * the meeting goes first and this after it: a storage failure is logged, never undoes the delete.
 */
export async function removeRecordingFiles(meetingId: string, stored: unknown): Promise<void> {
  try {
    const { keys, uploads } = recordingStorage(meetingId, stored)
    if (keys.length === 0 || !isStorageConfigured()) return
    await Promise.all(uploads.map((upload) => abortMultipartUpload(upload.key, upload.uploadId)))
    await removeObjects(keys)
  } catch (error: unknown) {
    console.error("Removing a meeting recording failed:", error instanceof Error ? error.message : error)
  }
}
