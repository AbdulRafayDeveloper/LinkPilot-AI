import { BookMarked, type LucideIcon } from "lucide-react"

/**
 * Reference Content: the steps, procedures, explanations and reusable text the user sends to
 * clients again and again. Each item is a title plus its text; nothing is generated here.
 */
export const REFERENCE_TITLE_MAX_LENGTH = 120
// The same ceiling the app uses for any long text (constants/prompts.ts)
export const REFERENCE_CONTENT_MAX_LENGTH = 20000
// The most items one request may return, enforced in the service, not just the page
export const REFERENCE_PAGE_SIZE = 50
// How much of an item a card shows before it is cut; Copy and Edit always use the whole text
export const REFERENCE_PREVIEW_MAX_LENGTH = 320
// Typing settles this long before a search runs
export const SEARCH_DEBOUNCE_MS = 300
export const REFERENCE_SEARCH_MAX_LENGTH = 100

export const REFERENCE_CONTENT_ENDPOINT = "/api/reference-content"

export const REFERENCE_CONTENT_MESSAGES = {
  missingTitle: "Give this content a name, so you can find it later.",
  titleTooLong: `The name must be under ${REFERENCE_TITLE_MAX_LENGTH} characters.`,
  missingContent: "Add the text you want to save.",
  contentTooLong: `The text must be under ${REFERENCE_CONTENT_MAX_LENGTH.toLocaleString()} characters.`,
  created: "Saved.",
  updated: "Changes saved.",
  deleted: "Deleted.",
  saveFailed: "Couldn't save it. Please try again.",
  deleteFailed: "Couldn't delete it. Please try again.",
  loadFailed: "Couldn't load your saved content.",
  moreFailed: "Couldn't load more. Scroll again to retry.",
  notFound: "That saved content no longer exists.",
  empty: "Nothing saved yet. Add the steps, instructions and explanations you send to clients again and again.",
  noResults: "Nothing matches that search.",
} as const

// The module's sidebar entry, under Client Work
export const REFERENCE_CONTENT_TOOL: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: "clients"
} = {
  id: "reference-content",
  title: "Clients Reference Content",
  description: "Reusable steps & explanations",
  icon: BookMarked,
  href: "/reference-content",
  group: "clients",
}
