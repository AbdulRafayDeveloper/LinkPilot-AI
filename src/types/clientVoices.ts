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

/** One voice kept with a client: what the page needs to list, play and read it. */
export interface SavedVoice {
  id: string
  clientId: string
  clientName: string
  position: number
  name: string
  size: number
  contentType: string
  transcript: string
  transcribedBy: string | null
  // The saved task list this voice was part of, when there is one
  taskGroupId: string | null
  createdAt: string
}

/** A saved task list, as it was written and as the user edited it. */
export interface SavedVoiceTasks {
  id: string
  clientId: string
  clientName: string
  tasks: ClientTask[]
  voiceIds: string[]
  missingVoices: number[]
  editedAt: string | null
  createdAt: string
}

export interface SavedVoicesPage {
  voices: SavedVoice[]
  // The task lists those voices belong to
  taskGroups: SavedVoiceTasks[]
  total: number
  page: number
  totalPages: number
}

/** One thing the client asked for, in the app's own words, taken from the transcripts. */
export interface ClientTask {
  // The client's request, written as something to do
  task: string
  // The voices it was asked in, 1-based, for the small label on the task
  voices: number[]
}

/** What the task step returns: the list, and whether it had every voice to work from. */
export interface TaskExtraction extends WithAiSource {
  tasks: ClientTask[]
  // Voices that had no transcript to give it, so the page can say the list is partial
  missingVoices: number[]
}

/** One transcript on its way to the task step. Only text is sent; the audio never is. */
export interface TranscriptInput {
  voice: number
  transcript: string
}

export type ClientVoicesPrompt = EditablePrompt
