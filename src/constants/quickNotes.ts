import { NotebookPen, type LucideIcon } from "lucide-react"

/**
 * Quick Notes: text the user pastes or types to keep for later reuse. No AI runs on it, so the
 * only limits here are what one note may hold and how many are listed at a time.
 */
// The app's largest text limit (constants/prompts.ts uses the same for a whole prompt)
export const NOTE_MAX_LENGTH = 20000
// How many notes one batch of the list holds; the next batch loads as the list is scrolled
export const NOTES_BATCH_SIZE = 40
// How much of a long note the list shows before it is cut; copying always takes the whole note
export const NOTE_PREVIEW_MAX_LENGTH = 600
// A title is a name to find the note by, not a second note
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

export const QUICK_NOTES_MESSAGES = {
  missingContent: "Write or paste something to save.",
  contentTooLong: `A note must be under ${NOTE_MAX_LENGTH.toLocaleString()} characters.`,
  titleTooLong: `A title must be under ${NOTE_TITLE_MAX_LENGTH} characters.`,
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
