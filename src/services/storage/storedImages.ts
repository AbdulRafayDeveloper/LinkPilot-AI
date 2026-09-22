import mongoose from "mongoose"
import { UserFacingError } from "@/lib/errors"
import { detectImageMimeType } from "@/lib/imageType"
import type { StoredImageRef, StoredImages } from "@/lib/storedImages"
import { deleteObject, isStorageConfigured, presignDownload, putObject } from "./s3"
import type { Viewer } from "@/types/auth"

/**
 * Storing, showing and removing the images inside a formatted text (lib/storedImages.ts says how
 * they are named), shared by Important Content and Quick Notes. Each module supplies its own names
 * (`images`) and says how to find the records that name an image.
 *
 * The bytes come through the app, one image per request: the bucket's CORS rule refuses uploads
 * straight from the browser on the live site, and one image of at most 4 MB fits the 4.5 MB body a
 * Vercel function takes. The type is read from the bytes, never from the browser, and the key is
 * built here from an id the server makes, under the uploader's own folder.
 *
 * An image is an attachment of the records that point at it, not a record of its own: it goes when
 * the last record naming it is deleted, and a storage failure there is logged, never fails the delete.
 * An image taken out of a text while editing is kept, because Undo can bring it back.
 */

export interface StoredImageMessages {
  storageUnavailable: string
  unsupported: string
  tooLarge: string
  uploadFailed: string
}

/** Stores one image for this account and answers the path a text names it by. */
export async function storeImage(images: StoredImages, viewer: Viewer, bytes: Buffer, maxBytes: number, messages: StoredImageMessages): Promise<string> {
  if (!isStorageConfigured()) throw new UserFacingError(messages.storageUnavailable)
  if (bytes.length === 0) throw new UserFacingError(messages.unsupported)
  if (bytes.length > maxBytes) throw new UserFacingError(messages.tooLarge)
  const type = detectImageMimeType(bytes)
  if (!type) throw new UserFacingError(messages.unsupported)
  const ref: StoredImageRef = { ownerId: viewer.id, file: images.fileOf(new mongoose.Types.ObjectId().toString(), type) }
  const key = images.keyOf(ref)
  if (!key) throw new UserFacingError(messages.uploadFailed)
  await putObject(key, bytes, type)
  return images.pathOf(ref)
}

/**
 * A short-lived link to one image, or null when this account may not see it. The account that
 * uploaded it always may (a text still being written names it before it is saved), and so may anyone
 * for whom `isShownTo` finds a record that names it, the same rule as the records themselves.
 */
export async function imageLink(
  images: StoredImages,
  viewer: Viewer,
  ref: StoredImageRef,
  isShownTo: (path: string) => Promise<boolean>
): Promise<string | null> {
  const key = images.keyOf(ref)
  const type = images.typeOf(ref.file)
  if (!key || !type || !isStorageConfigured()) return null
  if (viewer.id !== ref.ownerId && !(await isShownTo(images.pathOf(ref)))) return null
  return presignDownload(key, type)
}

/**
 * After records are deleted: removes the images their texts pointed at that no remaining record
 * names (a text copied into another record keeps its images).
 */
export async function removeUnnamedImages(
  images: StoredImages,
  texts: string[],
  isStillNamed: (path: string) => Promise<boolean>,
  label: string
): Promise<void> {
  const refs = texts.flatMap(images.imagesIn)
  if (refs.length === 0 || !isStorageConfigured()) return
  const unique = [...new Map(refs.map((ref) => [`${ref.ownerId}/${ref.file}`, ref])).values()]
  await Promise.all(
    unique.map(async (ref) => {
      const key = images.keyOf(ref)
      if (!key) return
      try {
        if (!(await isStillNamed(images.pathOf(ref)))) await deleteObject(key)
      } catch (error: unknown) {
        console.warn(`⚠️ Couldn't remove ${label} image:`, error instanceof Error ? error.message : error)
      }
    })
  )
}
