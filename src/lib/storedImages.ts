/**
 * Images inside a formatted text (Important Content descriptions, Quick Notes). The text stays
 * Markdown, so an image is a line `![alt](<endpoint>/<owner>/<file>)` pointing at the app's own route,
 * never at storage: the bucket is private, and a signed storage link would stop working after fifteen
 * minutes, so the route hands out a fresh one every time the image is shown.
 *
 * The path carries the owner, so the route can check the account without a record of its own, and
 * the file is an id the server made plus the type it read from the bytes. Nothing the browser sends
 * decides where an image is stored. Each module gets its own route and its own storage folder from
 * `defineStoredImages`. Kept free of the database and of storage, so it is testable.
 */

export const STORED_IMAGE_EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const
export type StoredImageType = keyof typeof STORED_IMAGE_EXTENSIONS

const EXTENSION_TYPES: Record<string, StoredImageType> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" }

const ID = /^[0-9a-f]{24}$/
const FILE = /^([0-9a-f]{24})\.(png|jpg|webp)$/

export interface StoredImageRef {
  ownerId: string
  file: string
}

export interface StoredImages {
  // The route that serves the images, which is also how a text names them
  endpoint: string
  // The storage folder, one folder per account under it
  keyPrefix: string
  pathOf: (ref: StoredImageRef) => string
  fileOf: (id: string, type: StoredImageType) => string
  // The storage key, or null when the owner or the file isn't one the app could have made
  keyOf: (ref: StoredImageRef) => string | null
  // The type an image is served with, read from its file name
  typeOf: (file: string) => StoredImageType | null
  // Every stored image a text points at, each once, in the order they appear
  imagesIn: (text: string) => StoredImageRef[]
}

const escapeForPattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)

export function defineStoredImages(endpoint: string, keyPrefix: string): StoredImages {
  const path = new RegExp(`${escapeForPattern(endpoint)}/([0-9a-f]{24})/([0-9a-f]{24}\\.(?:png|jpg|webp))`, "g")
  return {
    endpoint,
    keyPrefix,
    pathOf: ({ ownerId, file }) => `${endpoint}/${ownerId}/${file}`,
    fileOf: (id, type) => `${id}.${STORED_IMAGE_EXTENSIONS[type]}`,
    keyOf: ({ ownerId, file }) => (ID.test(ownerId) && FILE.test(file) ? `${keyPrefix}/${ownerId}/${file}` : null),
    typeOf: (file) => {
      const match = file.match(FILE)
      return match ? EXTENSION_TYPES[match[2]] : null
    },
    imagesIn: (text) => {
      const seen = new Set<string>()
      const refs: StoredImageRef[] = []
      for (const [, ownerId, file] of text.matchAll(path)) {
        const key = `${ownerId}/${file}`
        if (seen.has(key)) continue
        seen.add(key)
        refs.push({ ownerId, file })
      }
      return refs
    },
  }
}
