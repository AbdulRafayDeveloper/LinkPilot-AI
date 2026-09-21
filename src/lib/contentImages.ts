/**
 * Images inside an Important Content description. The description stays Markdown text, so an image
 * is a line `![alt](/api/important-content/images/<owner>/<file>)` pointing at the app's own route,
 * never at storage: the bucket is private, and a signed storage link would stop working after
 * fifteen minutes, so the route hands out a fresh one every time the image is shown.
 *
 * The path carries the owner, so the route can check the account without a record of its own, and
 * the file is an id the server made plus the type it read from the bytes. Nothing the browser sends
 * decides where an image is stored. Kept free of the database and of storage, so it is testable.
 */

export const CONTENT_IMAGES_ENDPOINT = "/api/important-content/images"

// Where the images are kept in storage, one folder per account
export const CONTENT_IMAGE_KEY_PREFIX = "LinkPilot/important-content"

export const CONTENT_IMAGE_EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const
export type ContentImageType = keyof typeof CONTENT_IMAGE_EXTENSIONS

const EXTENSION_TYPES: Record<string, ContentImageType> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" }

const ID = /^[0-9a-f]{24}$/
const FILE = /^([0-9a-f]{24})\.(png|jpg|webp)$/
const PATH = /\/api\/important-content\/images\/([0-9a-f]{24})\/([0-9a-f]{24}\.(?:png|jpg|webp))/g

export interface ContentImageRef {
  ownerId: string
  file: string
}

export const contentImagePath = ({ ownerId, file }: ContentImageRef) => `${CONTENT_IMAGES_ENDPOINT}/${ownerId}/${file}`

export const contentImageFile = (id: string, type: ContentImageType) => `${id}.${CONTENT_IMAGE_EXTENSIONS[type]}`

/** The storage key of an image, or null when the owner or the file isn't one the app could have made. */
export function contentImageKey({ ownerId, file }: ContentImageRef): string | null {
  return ID.test(ownerId) && FILE.test(file) ? `${CONTENT_IMAGE_KEY_PREFIX}/${ownerId}/${file}` : null
}

/** The type an image is served with, read from its file name. */
export function contentImageType(file: string): ContentImageType | null {
  const match = file.match(FILE)
  return match ? EXTENSION_TYPES[match[2]] : null
}

/** Every stored image a description points at, each once, in the order they appear. */
export function contentImagesIn(description: string): ContentImageRef[] {
  const seen = new Set<string>()
  const refs: ContentImageRef[] = []
  for (const [, ownerId, file] of description.matchAll(PATH)) {
    const key = `${ownerId}/${file}`
    if (seen.has(key)) continue
    seen.add(key)
    refs.push({ ownerId, file })
  }
  return refs
}
