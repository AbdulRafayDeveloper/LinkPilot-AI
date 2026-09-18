import type { RecordingStage, RecordingTrackId, UploadTrackId } from "@/constants/meetingRecording"

/**
 * A recorded meeting as it is kept on the meeting (`recording` on `meetings`, a Mixed field) and as the
 * page sees it. Chunks are kept by index in a map rather than a list, so confirming one is a single
 * `$set` on its own key and two chunks landing at once can never overwrite each other.
 */

/** One continuous video (the screen, or the camera), uploaded as a run of chunks and joined into one file. */
export interface StoredRecordingTrack {
  mimeType: string
  // Chunk index -> its size in bytes, for every chunk S3 confirmed
  chunks: Record<string, number>
  // How many chunks the recording has, fixed when it stops
  total: number | null
  // Joining: the multipart upload in progress and the next part to send (1-based)
  uploadId: string | null
  nextPart: number
  // The finished file, once joined
  finalKey: string | null
  finalSize: number
}

/** One self-contained piece of audio, written out on its own. */
export interface StoredAudioSegment {
  size: number
  mimeType: string
  // Where it starts in the recording, in milliseconds of recording time (pauses left out)
  startMs: number
  // Null until it is written out; "" when nobody spoke in it
  text: string | null
}

export interface StoredRecording {
  stage: RecordingStage
  startedAt: string
  stoppedAt: string | null
  // Recording time with the pauses left out; null when it was never stopped properly
  durationMs: number | null
  tracks: Partial<Record<RecordingTrackId, StoredRecordingTrack>>
  audio: { mimeType: string; segments: Record<string, StoredAudioSegment> }
  error: string | null
}

/** What the meeting page is told about a recording: no keys, only what it needs to show and drive it. */
export interface MeetingRecordingSummary {
  stage: RecordingStage
  startedAt: string
  durationMs: number | null
  hasCamera: boolean
  // Bytes that reached storage, per track
  uploadedBytes: Record<UploadTrackId, number>
  // Joining: chunks already in the finished file, out of all of them
  joined: { done: number; total: number }
  // Writing out: pieces written out, out of all of them
  transcribed: { done: number; total: number }
  error: string | null
}

/** Links to play or download what was recorded; every one of them is signed and expires. */
export interface MeetingRecordingLinks {
  screen: { url: string; downloadUrl: string; mimeType: string; size: number } | null
  camera: { url: string; mimeType: string } | null
  audio: { url: string; startMs: number }[]
}

/** How far one processing step got, so the page knows whether to call again. */
export interface RecordingStepState {
  recording: MeetingRecordingSummary
  // True while there is more joining or writing out to do
  hasMore: boolean
}
