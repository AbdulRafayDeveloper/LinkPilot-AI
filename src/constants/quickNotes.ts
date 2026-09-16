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

export const QUICK_NOTES_ENDPOINT = "/api/quick-notes"

export const QUICK_NOTES_MESSAGES = {
  missingContent: "Write or paste something to save.",
  contentTooLong: `A note must be under ${NOTE_MAX_LENGTH.toLocaleString()} characters.`,
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
  title: "Quick Notes",
  description: "Save text to reuse later",
  icon: NotebookPen,
  href: "/quick-notes",
  group: "workspace",
}
