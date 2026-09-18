/**
 * Recording a meeting straight from the app (Meeting Notes to Tasks): the screen and the meeting's sound,
 * your microphone mixed in, and a camera if you want one, uploaded while it records, then written out
 * and turned into notes by the same analysis a pasted transcript gets.
 *
 * Why it is shaped like this:
 * - **Every chunk goes from the browser to S3 itself**, through a link signed for that one chunk, so no
 *   recording ever passes through a serverless function and Vercel's 4.5 MB body limit never applies.
 * - **A chunk is at most `RECORDING_CHUNK_MAX_BYTES` (4 MB)**, which is also why the chunks are separate
 *   objects rather than parts of one multipart upload: S3 refuses parts under 5 MiB. After the recording
 *   stops, the server joins them into one file in steps short enough for any function limit.
 * - **The words come from a separate audio recording cut into self-contained pieces**
 *   (`AUDIO_SEGMENT_MS`), because a chunk of the video stream cannot be decoded on its own. Each piece is a
 *   small file Whisper on Groq can read by itself, so writing out a two hour meeting is many short calls.
 * - **No OpenAI here**: the pieces are written out by Groq only, and the notes are written with the
 *   meeting module's providers minus OpenAI.
 */

export const RECORDING_ENDPOINT = "/api/meetings/recordings"
export const recordingEndpoint = (meetingId: string) => `/api/meetings/${meetingId}/recording`

// Everything recorded lives here in the bucket, one folder per meeting
export const RECORDING_STORAGE_PREFIX = "LinkPilot/meeting-recordings"

/** The largest chunk ever uploaded in one PUT. */
export const RECORDING_CHUNK_MAX_BYTES = 4 * 1024 * 1024
// A chunk goes up at least this often even when it is small, so a closed tab loses seconds, not minutes
export const RECORDING_FLUSH_MS = 10_000
// How often the recorder hands over what it has, which is what the chunks are cut from
export const RECORDER_TIMESLICE_MS = 1_000
/** One self-contained audio file for transcription: five minutes of speech is about 2 MB. */
export const AUDIO_SEGMENT_MS = 5 * 60 * 1000
// A piece that grows past this is closed early, so no audio file can reach the chunk ceiling
export const AUDIO_SEGMENT_MAX_BYTES = 3 * 1024 * 1024

// Enough for readable text on a shared screen without filling the bucket; the camera needs far less
export const SCREEN_BITS_PER_SECOND = 2_500_000
export const CAMERA_BITS_PER_SECOND = 600_000
export const AUDIO_BITS_PER_SECOND = 64_000

/** S3's smallest multipart part (every part but the last), which is what the chunks are joined into. */
export const MULTIPART_MIN_PART_BYTES = 5 * 1024 * 1024
// One step of joining or writing out stops starting new work after this. A step is this plus at most one
// unit of work (one part of up to 8 MB, or one Groq call), so it stays inside a 60 second function even
// on a slow link between the server and S3
export const RECORDING_STEP_BUDGET_MS = 25_000
// Pieces written out per step; each is one Groq call of a few seconds
export const SEGMENTS_PER_STEP = 3
// A recording can't be longer than this many chunks per track (about 40 GB), which bounds every list
export const MAX_RECORDING_CHUNKS = 10_000

// The notes are the user's own text; the app's usual ceiling for a long one
export const MEETING_NOTES_MAX_LENGTH = 50_000

// Uploads that failed are tried again after this long, however many times it takes
export const UPLOAD_RETRY_MS = 5_000

export const RECORDING_TRACKS = ["screen", "camera"] as const
export type RecordingTrackId = (typeof RECORDING_TRACKS)[number]
// The upload tracks: the two videos and the audio pieces
export const UPLOAD_TRACKS = ["screen", "camera", "audio"] as const
export type UploadTrackId = (typeof UPLOAD_TRACKS)[number]

/**
 * Where a recording is. `recording` while it is taken and uploaded; `consolidating` while the chunks are
 * joined into one file; `transcribing` while the audio is written out; `done` once the transcript is on
 * the meeting (the ordinary analysis takes over from there); `failed` when a step stopped, which the
 * next step picks up again from where it was.
 */
export const RECORDING_STAGES = ["recording", "consolidating", "transcribing", "done", "failed"] as const
export type RecordingStage = (typeof RECORDING_STAGES)[number]

// What the browser may record in, and what the server accepts as each track's type
export const VIDEO_MIME_TYPES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"] as const
export const CAMERA_MIME_TYPES = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"] as const
export const AUDIO_MIME_TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm", "audio/mp4"] as const
export const STORED_VIDEO_TYPES = ["video/webm", "video/mp4"] as const
export const STORED_AUDIO_TYPES = ["audio/webm", "audio/ogg", "audio/mp4"] as const

/** The type a chunk is stored and signed with: the container without its codecs. */
export const baseMimeType = (mimeType: string) => mimeType.split(";")[0].trim().toLowerCase()

export const RECORDING_MESSAGES = {
  unsupported: "This browser can't record the screen. Use a recent Chrome, Edge or Firefox on a computer.",
  shareCancelled: "Screen sharing was cancelled, so nothing was recorded.",
  noSound:
    "There is no sound to record: share the meeting's tab or screen with its audio, or allow the microphone. Without sound the meeting can't be written out.",
  micDenied: "The microphone wasn't allowed, so only the meeting's own sound is recorded.",
  cameraDenied: "The camera wasn't allowed, so the screen is recorded without it.",
  storageUnavailable: "Recording needs file storage, which isn't set up on this deployment (the AWS variables).",
  startFailed: "Couldn't start the recording. Please try again.",
  uploadRetrying: "The connection dropped. Uploading again as soon as it's back; nothing recorded is lost.",
  stillUploading: "Some chunks are still uploading. Wait for them, then stop again.",
  notRecording: "This meeting isn't being recorded any more.",
  chunkTooLarge: "That chunk is larger than 4 MB, so it was refused.",
  chunkMissing: "That chunk didn't arrive in storage. It will be uploaded again.",
  nothingUploaded: "Nothing of this recording reached storage, so there is nothing to write out.",
  noSpeech: "No speech was heard in this recording, so there is nothing to write out.",
  transcriptionUnavailable: "Writing out a recording needs Groq's transcription model (GROQ_API_KEY_1 and GROQ_TRANSCRIPTION_MODEL).",
  processFailed: "Processing stopped. Everything uploaded is safe; press Try again to carry on.",
  leaveWarning: "A recording is still running or uploading. Leaving now stops it.",
  notesSaved: "Notes saved.",
  notesFailed: "Couldn't save the notes. Please try again.",
} as const
