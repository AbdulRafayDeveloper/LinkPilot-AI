import { AudioLines, type LucideIcon } from "lucide-react"

/**
 * Client Voices: the voice messages a client sends on WhatsApp or Slack, turned into English
 * transcripts and one list of the work they actually asked for.
 *
 * A batch with no client chosen stores nothing, as it always has: the audio goes from the browser to
 * the transcription provider, the transcripts live in the page, and the page is closed and it is gone.
 * Choosing a client keeps that batch instead: each recording goes to S3 and its transcript and task
 * list are saved with the client, so they can be played, read, edited and deleted later.
 */

// One batch. More than this in one go is a different conversation, not one client update
export const VOICE_BATCH_MAX = 15

/**
 * The largest single voice message. Vercel gives a serverless function a 4.5 MB request body,
 * and every voice is sent on its own, so this is the real ceiling rather than a guess. A voice
 * message is far smaller than this: a minute of WhatsApp audio is about 60 KB.
 */
export const VOICE_MAX_BYTES = 4 * 1024 * 1024

/** Roughly how long that is in speech, for the message shown when a file is too big. */
export const VOICE_MAX_LABEL = "4 MB"

/**
 * How many voices are transcribed at once. The providers rate limit, and a batch of 15 fired at
 * once is how a batch fails, so they go a few at a time.
 */
export const TRANSCRIBE_CONCURRENCY = 3

/**
 * What the file picker offers and what a pasted or dropped file is checked against. The server
 * checks the real container from the file's own bytes (lib/audioType.ts) whatever this says.
 */
export const ACCEPTED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/opus",
  "audio/flac",
]

// Some browsers hand over a voice file with no type at all, so the extension decides instead
export const ACCEPTED_AUDIO_EXTENSIONS = [".mp3", ".m4a", ".mp4", ".wav", ".webm", ".ogg", ".oga", ".opus", ".flac"]

export const TASK_LIST_MAX = 40
export const TRANSCRIPT_MAX_LENGTH = 20000

export const CLIENT_VOICES_PROMPT_ID = "client-voice-tasks"
export const CLIENT_VOICES_PROMPT_TABS = [{ id: CLIENT_VOICES_PROMPT_ID, label: "Task extraction" }]

export const CLIENT_VOICES_ENDPOINT = "/api/client-voices"
// Where a kept recording lives in the bucket, beside the other modules' prefixes
export const VOICE_STORAGE_PREFIX = "LinkPilot/client-voices"
// The saved voices list, a page at a time
export const SAVED_VOICES_PAGE_SIZE = 20
// Where the chosen client is remembered, so the page opens on the same client next time
export const CLIENT_CHOICE_KEY = "clientVoices:client"
// Filters for the saved list
export const VOICE_FILTERS = [
  { id: "client", label: "This client" },
  { id: "all", label: "All clients" },
] as const
export type VoiceFilterId = (typeof VOICE_FILTERS)[number]["id"]
// Every voice is transcribed on its own, through the app's shared transcription endpoint
export const TRANSCRIBE_ENDPOINT = "/api/transcribe"

export const CLIENT_VOICES_MESSAGES = {
  noVoices: "Add at least one voice message first.",
  batchFull: `You can process ${VOICE_BATCH_MAX} voice messages at a time. Remove one to add another.`,
  unsupported: "That isn't an audio file. Voice messages in MP3, M4A, OGG, OPUS, WAV, WEBM or FLAC work.",
  tooLarge: `Each voice message must be under ${VOICE_MAX_LABEL}.`,
  emptyFile: "That file is empty.",
  nothingPasted: "There is no voice message on the clipboard. Some apps only copy a link, so save the voice and drop the file here instead.",
  clipboardBlocked: "This browser won't let the page read the clipboard. Paste with Ctrl+V, or drop the file here instead.",
  transcriptionFailed: "Couldn't turn this voice into text.",
  tasksFailed: "Couldn't work out the tasks. The transcripts are still here, so you can try again.",
  noTranscripts: "None of the voices could be transcribed, so there is nothing to take tasks from.",
  copied: "Tasks copied.",
  clientMissing: "That client no longer exists. Choose another one.",
  storageUnavailable: "Keeping a client's voices needs file storage. Set the AWS variables where the app runs, or work without choosing a client.",
  noClient: "Choose a client to keep these voices with, or leave it on none and nothing is saved.",
  savedVoicesFailed: "Couldn't load the saved voices. Please try again.",
  saveFailed: "Couldn't keep this voice with the client. Its transcript is still here.",
  deleteFailed: "Couldn't delete that voice. Please try again.",
  deleted: "Voice deleted.",
  taskEditFailed: "Couldn't save your changes to the tasks.",
  noSavedVoices: "No voices kept yet. Choose a client before you transcribe, and every voice is kept here with its tasks.",
} as const

// The module's sidebar entry, with the other work done for clients
export const CLIENT_VOICES_TOOL: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: "clients"
} = {
  id: "client-voices",
  title: "Client Voices to Tasks",
  description: "Voice notes into tasks",
  icon: AudioLines,
  href: "/client-voices",
  group: "clients",
}
