import { FileKey2, type LucideIcon } from "lucide-react"

/**
 * Important Content: named pieces of text worth keeping to hand (logins for a client's staging
 * site, API endpoints, account numbers, standard replies), each with an optional description and a
 * type the user makes up themselves. Nothing is generated here. Like every workspace module, an
 * entry belongs to the account that saved it; an admin sees everyone's.
 */

export const IMPORTANT_CONTENT_ENDPOINT = "/api/important-content"

export const CONTENT_NAME_MAX_LENGTH = 120
// The same ceiling the app uses for any long text
export const CONTENT_DESCRIPTION_MAX_LENGTH = 20000
export const CONTENT_TYPE_MAX_LENGTH = 60
// How much of a description the table shows; Copy and Edit always use the whole text
export const CONTENT_PREVIEW_MAX_LENGTH = 220

/**
 * The size a description is written and read at, in pixels, chosen per entry with A− and A+ and saved
 * with it. An entry saved before sizes existed reads at the default, which is what every entry was.
 */
export const CONTENT_TEXT_SIZES = [12, 13, 14, 16, 18, 20, 24] as const
export const DEFAULT_CONTENT_TEXT_SIZE = 14

/**
 * One image in a description, uploaded through the app rather than straight to storage: the
 * bucket's CORS rule refuses browser uploads from the live site, and 4 MB fits the 4.5 MB request
 * body a Vercel function takes.
 */
export const CONTENT_IMAGE_MAX_BYTES = 4 * 1024 * 1024
export const CONTENT_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp"

// How long after the last change an edit saves itself, and how long "Saved" stays in view
export const CONTENT_AUTOSAVE_DELAY_MS = 1500

export const IMPORTANT_CONTENT_MESSAGES = {
  missingName: "Give this content a name, so you can find it later.",
  nameTooLong: `The name must be under ${CONTENT_NAME_MAX_LENGTH} characters.`,
  descriptionTooLong: `The description must be under ${CONTENT_DESCRIPTION_MAX_LENGTH.toLocaleString()} characters.`,
  missingType: "Give it a type, for example Credentials, Link or Snippet.",
  typeTooLong: `The type must be under ${CONTENT_TYPE_MAX_LENGTH} characters.`,
  created: "Content saved.",
  updated: "Changes saved.",
  deleted: "Content deleted.",
  saveFailed: "Couldn't save the content. Please try again.",
  deleteFailed: "Couldn't delete the content. Please try again.",
  loadFailed: "Couldn't load your content. Please try again.",
  notFound: "That content no longer exists.",
  empty: "Nothing saved yet. Add the logins, links and text you need to find again quickly.",
  noResults: "No content matches these filters.",
  badTextSize: "Choose one of the text sizes offered.",
  imageUnsupported: "Add a PNG, JPG or WEBP image.",
  imageTooLarge: `Images must be ${CONTENT_IMAGE_MAX_BYTES / (1024 * 1024)} MB or smaller.`,
  imageUploadFailed: "Couldn't add that image. Please try again.",
  imageStorageUnavailable: "Images can't be added here yet: file storage isn't set up.",
  imageNotFound: "That image isn't available.",
  imageBadAddress: "Use an image address that starts with https://.",
  // Auto-save, which only an edit has: a new entry is saved with the button
  autosaving: "Saving...",
  autosaved: (time: string) => `Auto-saved at ${time}`,
  autosaveWaiting: "Changes not saved yet: the name and the type are needed.",
  autosaveFailed: "Auto-save failed. Your changes are still here; Save changes tries again.",
} as const

export const IMPORTANT_CONTENT_TOOL: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: "workspace"
} = {
  id: "important-content",
  title: "Important Content",
  description: "Named text with your own types",
  icon: FileKey2,
  href: "/important-content",
  group: "workspace",
}
