import { AudioLines, type LucideIcon } from "lucide-react"

/**
 * Client Voices: the voice messages a client sends on WhatsApp or Slack, turned into English
 * transcripts, one list of the work they asked for, and one list of what they asked about.
 *
 * **Every batch is kept**, at the owner's request that no voice is ever lost: the batch record is
 * written as the run starts, each recording goes to S3 with its transcript, and the tasks and the
 * questions are saved onto it when they are written. Choosing a client only says whose batch it is;
 * a batch with no client is kept exactly the same way. The create page runs one batch, and the
 * "view all" page lists every batch ever run, each opening on its own page with its recordings to
 * play, its transcripts, its tasks and its questions.
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

/**
 * What one voice says, written out again in clear words: a few short lines rather than one block,
 * because a voice message wanders and a list of points does not. Six is as many distinct things as
 * anyone says in one voice message; more than that is the model padding rather than reading.
 */
export const CLEAR_POINTS_MAX = 6
export const CLEAR_POINT_MAX_LENGTH = 400

export const TASK_LIST_MAX = 40
/**
 * How many questions one batch may come back with. A client asking more than this in a handful of
 * voice messages is not asking questions any more, so a longer list is read as the model drifting.
 */
export const QUESTION_LIST_MAX = 30
export const TRANSCRIPT_MAX_LENGTH = 20000

export const CLIENT_VOICES_PROMPT_ID = "client-voice-tasks"
export const CLIENT_VOICES_PROMPT_TABS = [{ id: CLIENT_VOICES_PROMPT_ID, label: "Task extraction" }]

export const CLIENT_VOICES_ENDPOINT = "/api/client-voices"
// Every batch ever run: started, added to as it goes, listed and opened through this one path
export const VOICE_BATCHES_ENDPOINT = `${CLIENT_VOICES_ENDPOINT}/batches`
// Where a kept recording lives in the bucket, beside the other modules' prefixes
export const VOICE_STORAGE_PREFIX = "LinkPilot/client-voices"

/** The tool's two pages: the batch being run, and every batch kept. */
export const CLIENT_VOICES_HISTORY_HREF = "/client-voices/history"
/** One kept batch, on its own page. */
export const clientVoicesBatchHref = (id: string) => `/client-voices/${id}`

/**
 * A batch's own name, which is what the list is read by. The user may give it one as they run the
 * batch; when they do not, the model writes one from the voices themselves, so a row never reads as
 * a date and nothing else.
 */
export const BATCH_TITLE_MAX_LENGTH = 120

/**
 * What the client filter sends for the batches kept under no client. It can never be mistaken for a
 * client, whose id is 24 hex characters, the way the folder filters' own two values cannot.
 */
export const NO_CLIENT_FILTER = "none"
/**
 * The page's own two choices, kept **on the account** so they follow it to any browser and stay put
 * until the user changes them: the client a batch is kept under, and whether a batch is kept at all.
 * This browser keeps a copy as well, only so the page can show them before the account has answered.
 */
export const VOICE_CHOICES_ENDPOINT = `${CLIENT_VOICES_ENDPOINT}/choices`
export const CLIENT_CHOICE_KEY = "clientVoices:client"
export const TEMPORARY_CHOICE_KEY = "clientVoices:temporary"
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
  noClient: "Every batch is kept. Choose a client to keep this one under their name.",
  keptWith: (name: string) => `This batch is kept under ${name}, with its recordings, transcripts, tasks and questions.`,
  clientChoiceFailed: "Couldn't remember that client for next time. It is still chosen on this page.",
  notYourClient: "That client no longer exists.",
  savedVoicesFailed: "Couldn't load the saved voices. Please try again.",
  saveFailed: "Couldn't keep this voice with the client. Its transcript is still here.",
  deleteFailed: "Couldn't delete that voice. Please try again.",
  deleted: "Voice deleted.",
  taskEditFailed: "Couldn't save your changes to the tasks.",
  // Keeping the batch itself. The transcripts are on the page either way, so this is never fatal
  batchFailed: "Couldn't start keeping this batch, so these voices will not be saved. The transcripts still work.",
  // The "view all" page and one batch's own page
  historyFailed: "Couldn't load the batches. Please try again.",
  batchMissing: "That batch no longer exists.",
  emptyHistory: "No voice messages have been run through yet. Open Client Voices and add the first batch.",
  noMatches: "No batch matches those filters.",
  deleteBatchFailed: "Couldn't delete that batch. Please try again.",
  batchDeleted: "Batch deleted.",
  // A recording that was never stored, because the app had no file storage when the batch ran
  noRecording: "The recording was not kept for this voice.",
  playFailed: "Couldn't play this recording. Open the page again for a fresh link.",
  questionsEmpty: "The client did not ask anything in these voices.",
  copiedQuestions: "Questions copied.",
  // Running a batch without keeping it, and the choice that says so
  temporary: "Use these voices once, don't save them",
  temporaryHint: "Nothing is written down: no recordings, no transcripts, no lists. Closing the page is the end of it.",
  notSaved: "This batch was not saved. Copy what you need before you leave the page.",
  temporaryChoiceFailed: "Couldn't remember that for next time. It still holds on this page.",
  // The batch's own name
  title: "Title (optional)",
  titleHint: "Left empty, a title is written from the voices themselves.",
  titlePlaceholder: "What this batch is about",
  untitled: "Untitled batch",
  // What one voice said, in clear words
  clearHeading: "In clear words",
  clearHint: "One point per line.",
  clearEmpty: "This voice has not been written out in clear words yet.",
  // Editing a kept batch
  edit: "Edit",
  save: "Save",
  cancel: "Cancel",
  editFailed: "Couldn't save those changes. Please try again.",
  addTask: "Add a task",
  addQuestion: "Add a question",
  removeTask: "Remove this task",
  removeQuestion: "Remove this question",
  transcriptSaved: "Transcript saved.",
  confirmDeleteBatch: "Its recordings, transcripts, tasks and questions all go with it.",
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
