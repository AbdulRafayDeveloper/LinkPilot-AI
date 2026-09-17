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
