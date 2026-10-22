import type { EditablePrompt } from "./prompts"
import type { WithAiSource } from "./ai"

/**
 * Where one voice message has got to. Every voice the user added holds one of these until the
 * page is left, so a voice can never quietly disappear from the batch.
 */
export type VoiceStatus = "ready" | "queued" | "transcribing" | "done" | "failed"

/**
 * One voice message in the batch, as the page holds it. The file never leaves the browser
 * except as the body of its own transcription request, and nothing here is saved anywhere.
 */
export interface VoiceEntry {
  id: string
  // 1-based, fixed when the voice is added, so transcripts stay in the order they arrived
  position: number
  file: File
  name: string
  size: number
  // "paste", "drop" or "file", so the page can say how a voice arrived
  source: VoiceSource
  status: VoiceStatus
  transcript: string
  // Which provider wrote the transcript out
  transcribedBy?: string | null
  error: string | null
}

export type VoiceSource = "paste" | "drop" | "file"

/** One kept voice: what a page needs to list it, read it and play it. */
export interface SavedVoice {
  id: string
  // The batch it arrived in (stored as `taskGroupId`, see models/ClientVoice.ts)
  batchId: string | null
  clientId: string
  clientName: string
  position: number
  name: string
  size: number
  contentType: string
  transcript: string
  transcribedBy: string | null
  createdAt: string
  /**
   * Short-lived signed links, on a batch's own page only: `playUrl` is the recording played where
   * it is, `downloadUrl` the same bytes saved under their own name. Both are null for a voice whose
   * recording was never stored, which is what a batch run with no file storage leaves behind.
   */
  playUrl?: string | null
  downloadUrl?: string | null
}

/**
 * One batch as the list shows it: when it was run, whose it was, and how much came out of it.
 * The counts are the batch's own facts, so a row needs nothing joined to it.
 */
export interface VoiceBatch {
  id: string
  clientId: string
  clientName: string
  // How many voices were put in, however many could be written out
  voiceCount: number
  tasks: ClientTask[]
  questions: ClientQuestion[]
  // The voices that had no transcript to give, so the lists were made without them
  missingVoices: number[]
  provider: string | null
  providers: string[]
  // When the user last reworded the task list
  editedAt: string | null
  createdAt: string
}

/** One batch opened: everything that came out of it, with its recordings to play. */
export interface VoiceBatchDetail extends VoiceBatch {
  voices: SavedVoice[]
}

export interface VoiceBatchesPage {
  items: VoiceBatch[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  // The clients these batches were kept under, for the filter: only the records can say which exist
  clients: { id: string; name: string }[]
}

/** One thing the client asked for, in the app's own words, taken from the transcripts. */
export interface ClientTask {
  // The client's request, written as something to do
  task: string
  // The voices it was asked in, 1-based, for the small label on the task
  voices: number[]
}

/**
 * One thing the client asked **about**, rather than asked for. A question is not a task: nothing
 * is done about it, it is answered, so the two are kept apart and never folded together.
 */
export interface ClientQuestion {
  // The client's question, in clear English
  question: string
  // The voices it was asked in, 1-based
  voices: number[]
}

/** What the task step returns: both lists, and whether it had every voice to work from. */
export interface TaskExtraction extends WithAiSource {
  tasks: ClientTask[]
  questions: ClientQuestion[]
  // Voices that had no transcript to give it, so the page can say the lists are partial
  missingVoices: number[]
  // The batch all of this is kept under, when the page started one
  batchId?: string | null
}

/** One transcript on its way to the task step. Only text is sent; the audio never is. */
export interface TranscriptInput {
  voice: number
  transcript: string
}

export type ClientVoicesPrompt = EditablePrompt
