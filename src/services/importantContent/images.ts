import mongoose from "mongoose"
import { UserFacingError } from "@/lib/errors"
import { escapeForSearch } from "@/lib/listQuery"
import { detectImageMimeType } from "@/lib/imageType"
import { contentImageFile, contentImageKey, contentImagePath, contentImagesIn, contentImageType, type ContentImageRef } from "@/lib/contentImages"
import { CONTENT_IMAGE_MAX_BYTES, IMPORTANT_CONTENT_MESSAGES } from "@/constants/importantContent"
import { ImportantContentModel } from "@/models/ImportantContent"
import { deleteObject, isStorageConfigured, presignDownload, putObject } from "@/services/storage/s3"
import { visibleTo } from "@/services/auth/viewer"
import type { Viewer } from "@/types/auth"

/**
 * The images inside Important Content descriptions (lib/contentImages.ts says how they are named).
 *
 * The bytes come through the app, one image per request: the bucket's CORS rule refuses uploads
 * straight from the browser on the live site, and one image of at most 4 MB fits the 4.5 MB body a
 * Vercel function takes. The type is read from the bytes, never from the browser, and the key is
 * built here from an id the server makes, under the uploader's own folder.
 *
 * An image is an attachment of the entries that point at it, not a record of its own: it goes when
 * the last entry naming it is deleted, and a storage failure there is logged, never fails the delete.
 * An image taken out of a description while editing is kept, because Undo can bring it back.
 */

/** Stores one image for this account and answers the path a description names it by. */
export async function storeContentImage(viewer: Viewer, bytes: Buffer): Promise<string> {
  if (!isStorageConfigured()) throw new UserFacingError(IMPORTANT_CONTENT_MESSAGES.imageStorageUnavailable)
  if (bytes.length === 0) throw new UserFacingError(IMPORTANT_CONTENT_MESSAGES.imageUnsupported)
  if (bytes.length > CONTENT_IMAGE_MAX_BYTES) throw new UserFacingError(IMPORTANT_CONTENT_MESSAGES.imageTooLarge)
  const type = detectImageMimeType(bytes)
  if (!type) throw new UserFacingError(IMPORTANT_CONTENT_MESSAGES.imageUnsupported)
  const ref: ContentImageRef = { ownerId: viewer.id, file: contentImageFile(new mongoose.Types.ObjectId().toString(), type) }
  const key = contentImageKey(ref)
  if (!key) throw new UserFacingError(IMPORTANT_CONTENT_MESSAGES.imageUploadFailed)
  await putObject(key, bytes, type)
  return contentImagePath(ref)
}

// The entries that name an image, by its file, which is an id no other image shares
const naming = (ref: ContentImageRef) => ({ description: { $regex: escapeForSearch(contentImagePath(ref)) } })

/**
 * A short-lived link to one image, or null when this account may not see it. The account that
 * uploaded it always may (an entry still being written names it before it is saved), and so may
 * anyone who can see an entry that names it, the same rule as the entries themselves.
 */
export async function contentImageLink(viewer: Viewer, ref: ContentImageRef): Promise<string | null> {
  const key = contentImageKey(ref)
  const type = contentImageType(ref.file)
  if (!key || !type || !isStorageConfigured()) return null
  if (viewer.id !== ref.ownerId && !(await ImportantContentModel.exists({ $and: [visibleTo(viewer), naming(ref)] }))) return null
  return presignDownload(key, type)
}

/**
 * After entries are deleted: removes the images they pointed at that no remaining entry names (a
 * description copied into another entry keeps its images).
 */
export async function removeUnusedImages(descriptions: string[]): Promise<void> {
  const refs = descriptions.flatMap(contentImagesIn)
  if (refs.length === 0 || !isStorageConfigured()) return
  const unique = [...new Map(refs.map((ref) => [`${ref.ownerId}/${ref.file}`, ref])).values()]
  await Promise.all(
    unique.map(async (ref) => {
      const key = contentImageKey(ref)
      if (!key) return
      try {
        const stillUsed = await ImportantContentModel.exists(naming(ref))
        if (!stillUsed) await deleteObject(key)
      } catch (error: unknown) {
        console.warn("⚠️ Couldn't remove an Important Content image:", error instanceof Error ? error.message : error)
      }
    })
  )
}
