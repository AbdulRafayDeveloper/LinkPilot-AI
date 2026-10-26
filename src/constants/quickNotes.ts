import { NotebookPen, type LucideIcon } from "lucide-react"
import { TEXT_BOX_MAX_LENGTH } from "./textLimits"
import { REQUEST_MAX_LENGTH } from "./promptCreator"

/**
 * Quick Notes: text the user pastes, types or speaks to keep for later reuse. A saved note is never
 * read by a model; the only AI here is reading a spoken note back in English before it reaches the
 * editor, so the limits below are what one note may hold, how much speech is read, and how many
 * notes are listed at a time.
 */
// No AI reads a saved note, so it takes the shared ceiling for a plain text box (constants/textLimits.ts)
export const NOTE_MAX_LENGTH = TEXT_BOX_MAX_LENGTH
// How many notes one batch of the list holds; the next batch loads as the list is scrolled
export const NOTES_BATCH_SIZE = 40
// How much of a long note the list shows before it is cut; copying always takes the whole note
export const NOTE_PREVIEW_MAX_LENGTH = 600
// A name to find the note by, not a second note. The field is still `title` in the API and the
// database; only the word on the page changed, to Name, so it is the same word Important Content uses
export const NOTE_TITLE_MAX_LENGTH = 120
/**
 * An edited note saves itself this long after the last change, the same pause Important Content
 * waits, so typing a sentence is one write rather than one per key.
 */
export const NOTE_AUTOSAVE_DELAY_MS = 1500
/**
 * One image in a note, uploaded through the app rather than straight to storage (the bucket refuses
 * browser uploads from the live site), so it has to fit the 4.5 MB body a Vercel function takes.
 */
export const NOTE_IMAGE_MAX_BYTES = 4 * 1024 * 1024
export const NOTE_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp"

export const QUICK_NOTES_ENDPOINT = "/api/quick-notes"
// Reads what was spoken back in English; it stores nothing, the note is saved as usual afterwards
export const QUICK_NOTES_ENGLISH_ENDPOINT = "/api/quick-notes/english"
/**
 * How much spoken text is read back in English at once: a whole six-minute recording, the same
 * ceiling every other spoken field has (Prompt Creator's description, a client update). This one is
 * read by a model, so it stays far under the note's own million characters.
 */
export const NOTE_SPEECH_MAX_LENGTH = REQUEST_MAX_LENGTH

export const QUICK_NOTES_MESSAGES = {
  missingContent: "Write or paste something to save.",
  contentTooLong: `A note must be under ${NOTE_MAX_LENGTH.toLocaleString()} characters.`,
  titleTooLong: `A name must be under ${NOTE_TITLE_MAX_LENGTH} characters.`,
  notFound: "That note no longer exists.",
  imageUnsupported: "Add a PNG, JPG or WEBP image.",
  imageTooLarge: `Images must be ${NOTE_IMAGE_MAX_BYTES / (1024 * 1024)} MB or smaller.`,
  imageUploadFailed: "Couldn't add that image. Please try again.",
  imageStorageUnavailable: "Images can't be added here yet: file storage isn't set up.",
  imageNotFound: "That image isn't available.",
  imageBadAddress: "Use an image address that starts with https://.",
  autosaving: "Saving...",
  autosaved: (time: string) => `Auto-saved at ${time}`,
  autosaveWaiting: "Changes not saved yet: a note needs some content.",
  autosaveFailed: "Auto-save failed. Your changes are still here; Save changes tries again.",
  saved: "Saved.",
  saveFailed: "Couldn't save the note. Please try again.",
  loadFailed: "Couldn't load your saved notes.",
  clearFailed: "Couldn't clear the notes. Please try again.",
  deleteFailed: "Couldn't delete that note. Please try again.",
  moreFailed: "Couldn't load more notes. Scroll again to retry.",
  cleared: "All notes deleted.",
  empty: "Nothing saved yet. Paste or write something on the right and save it to keep it here.",
  // Moving a note into Important Content, where it becomes a named entry with a type
  moveExplains: "The note is saved in Important Content with this name and type, and leaves Quick Notes.",
  moved: (name: string) => `"${name}" is now in Important Content.`,
  movedButKept: (name: string) => `"${name}" is saved in Important Content, but the note could not be deleted here. Delete it yourself.`,
  moveFailed: "Couldn't move the note to Important Content. It is still here; please try again.",
  moveUnavailable: "Important Content is turned off for this account, so a note cannot be moved there.",
  // Speaking a note: what was said is written out, read back in English and added to the editor
  speechMissing: "Nothing was heard to write in English.",
  speechTooLong: `That recording is too long to read back at once. Keep it under ${NOTE_SPEECH_MAX_LENGTH.toLocaleString()} characters.`,
  speechEnglishing: "Writing what you said in English...",
  speechEnglishFailed: "Couldn't write what you said in English. What you said is kept below.",
  speechAdded: (language: string) =>
    language && !/^english$/i.test(language) ? `Added to the note in English (you spoke ${language}).` : "Added to the note in English.",
  speechClipped: (count: number) => `The note was full, so the last ${count.toLocaleString()} characters were left out.`,
  speechAddAsSaid: "Add it as you said it",
} as const

// The module's sidebar entry, listed with the other non-LinkedIn modules
export const QUICK_NOTES_TOOL: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: "workspace"
} = {
  id: "quick-notes",
  title: "Temporary Quick Notes",
  description: "Save text to reuse later",
  icon: NotebookPen,
  href: "/quick-notes",
  group: "workspace",
}
