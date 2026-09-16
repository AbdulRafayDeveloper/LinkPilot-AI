import { FileAudio, FileText, FileType, FileVideo, Image, Files, type LucideIcon } from "lucide-react"

/**
 * Important Files: the images, documents, videos and audio worth keeping to hand and sending
 * again. Every file is stored in S3 under one prefix and reached only through signed URLs.
 *
 * The categories below are the single mapping from a content type to what the app calls it.
 * Both the filters and the server-side validation read them, so a type the app cannot place
 * is a type it does not accept.
 */
export const ASSET_CATEGORIES = [
  {
    id: "image",
    label: "Images",
    icon: Image,
    // What the browser sends for these files; the server accepts nothing outside this list
    contentTypes: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "image/svg+xml", "image/bmp", "image/tiff"],
    // 25 MB is far more than a photo needs and still uploads in one request
    maxBytes: 25 * 1024 * 1024,
  },
  {
    id: "pdf",
    label: "PDF",
    icon: FileType,
    contentTypes: ["application/pdf"],
    maxBytes: 100 * 1024 * 1024,
  },
  {
    id: "word",
    label: "Word",
    icon: FileText,
    contentTypes: [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/rtf",
      "application/vnd.oasis.opendocument.text",
    ],
    maxBytes: 100 * 1024 * 1024,
  },
  {
    id: "text",
    label: "Text",
    icon: FileText,
    contentTypes: ["text/plain", "text/markdown", "text/csv", "application/json"],
    maxBytes: 25 * 1024 * 1024,
  },
  {
    id: "video",
    label: "Video",
    icon: FileVideo,
    contentTypes: ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska", "video/x-msvideo"],
    // The module's largest file. Multipart upload sends it straight to S3 in parts, so the
    // size never touches a serverless request
    maxBytes: 500 * 1024 * 1024,
  },
  {
    id: "audio",
    label: "Audio",
    icon: FileAudio,
    contentTypes: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "audio/flac", "audio/aac"],
    maxBytes: 200 * 1024 * 1024,
  },
] as const

export type AssetCategoryId = (typeof ASSET_CATEGORIES)[number]["id"]

export const ASSET_CATEGORY_IDS = ASSET_CATEGORIES.map((category) => category.id) as [AssetCategoryId, ...AssetCategoryId[]]

/** The filter row: everything, then one entry per category. */
export const ASSET_FILTERS = [{ id: "all", label: "All", icon: Files }, ...ASSET_CATEGORIES] as const

export type AssetFilterId = "all" | AssetCategoryId

/** The category a content type belongs to, or null when the app does not accept that type. */
export function categoryForContentType(contentType: string): AssetCategoryId | null {
  const type = contentType.split(";")[0].trim().toLowerCase()
  return ASSET_CATEGORIES.find((category) => (category.contentTypes as readonly string[]).includes(type))?.id ?? null
}

export function assetCategory(category: AssetCategoryId) {
  return ASSET_CATEGORIES.find((entry) => entry.id === category) ?? ASSET_CATEGORIES[0]
}

export function getCategoryLabel(category: AssetCategoryId): string {
  return assetCategory(category).label
}

/** The largest file this category accepts, checked on the server before anything is stored. */
export function maxBytesFor(category: AssetCategoryId): number {
  return assetCategory(category).maxBytes
}

/** The largest file the module accepts at all, used for the file picker and the first check. */
export const ASSET_MAX_BYTES = Math.max(...ASSET_CATEGORIES.map((category) => category.maxBytes))

/** Everything the file picker offers, so the dialog cannot even choose an unsupported type. */
export const ACCEPTED_CONTENT_TYPES = ASSET_CATEGORIES.flatMap((category) => [...category.contentTypes])

/**
 * Anything larger than this goes up in parts. It is also Vercel's own request body ceiling,
 * which is why nothing above it may be sent through the app at all.
 */
export const MULTIPART_THRESHOLD_BYTES = 4 * 1024 * 1024
// S3 refuses a part under 5 MB (except the last one), and 8 MB keeps a 500 MB file inside 63 parts
export const UPLOAD_PART_BYTES = 8 * 1024 * 1024
// A part that fails is sent again this many times before the upload gives up
export const UPLOAD_PART_RETRIES = 2

export const ASSET_NAME_MAX_LENGTH = 120
export const ASSET_DESCRIPTION_MAX_LENGTH = 2000
// The most assets one request may return, enforced in the service, not just the page
export const ASSET_PAGE_SIZE = 24
// How much of a description a card shows before it is cut
export const ASSET_DESCRIPTION_PREVIEW_LENGTH = 140
// Typing settles this long before a search runs
export const SEARCH_DEBOUNCE_MS = 300
export const ASSET_SEARCH_MAX_LENGTH = 100
// How long a preview or download link stays valid
export const SIGNED_URL_TTL_SECONDS = 15 * 60

export const IMPORTANT_FILES_ENDPOINT = "/api/important-files"

export const IMPORTANT_FILES_MESSAGES = {
  missingFile: "Choose the file you want to keep.",
  missingName: "Give this file a name, so you can find it later.",
  nameTooLong: `The name must be under ${ASSET_NAME_MAX_LENGTH} characters.`,
  descriptionTooLong: `The description must be under ${ASSET_DESCRIPTION_MAX_LENGTH.toLocaleString()} characters.`,
  unsupportedType: "That file type isn't supported. Images, PDF, Word, text, video and audio are.",
  tooLarge: "That file is larger than this type allows.",
  storageUnavailable: "File storage isn't configured. Set the AWS variables in .env.local (see .env.example).",
  uploadFailed: "The upload didn't finish. Please try again.",
  created: "Saved.",
  updated: "Changes saved.",
  deleted: "Deleted.",
  saveFailed: "Couldn't save it. Please try again.",
  deleteFailed: "Couldn't delete it. Please try again.",
  loadFailed: "Couldn't load your files.",
  moreFailed: "Couldn't load more. Scroll again to retry.",
  notFound: "That file no longer exists.",
  linkFailed: "Couldn't open that file. Please try again.",
  empty: "Nothing saved yet. Add the images, documents, videos and audio you send again and again.",
  noResults: "Nothing matches that search.",
  copied: "Copied.",
  copyFailed: "Couldn't copy that file. Download it instead.",
} as const

// The module's sidebar entry, with the other things the user keeps rather than generates
export const IMPORTANT_FILES_TOOL: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: "workspace"
} = {
  id: "important-files",
  title: "Important Files",
  description: "Images, docs, video & audio",
  icon: Files,
  href: "/important-files",
  group: "workspace",
}
