import { escapeForSearch } from "@/lib/listQuery"
import { CONTENT_IMAGES, type ContentImageRef } from "@/lib/contentImages"
import { CONTENT_IMAGE_MAX_BYTES, IMPORTANT_CONTENT_MESSAGES } from "@/constants/importantContent"
import { ImportantContentModel } from "@/models/ImportantContent"
import { imageLink, removeUnnamedImages, storeImage } from "@/services/storage/storedImages"
import { visibleTo } from "@/services/auth/viewer"
import type { Viewer } from "@/types/auth"

/**
 * The images inside Important Content descriptions (lib/contentImages.ts says how they are named,
 * services/storage/storedImages.ts how they are stored, shown and removed).
 */

// The entries that name an image, by its path, whose file is an id no other image shares
const naming = (path: string) => ({ description: { $regex: escapeForSearch(path) } })

/** Stores one image for this account and answers the path a description names it by. */
export const storeContentImage = (viewer: Viewer, bytes: Buffer): Promise<string> =>
  storeImage(CONTENT_IMAGES, viewer, bytes, CONTENT_IMAGE_MAX_BYTES, {
    storageUnavailable: IMPORTANT_CONTENT_MESSAGES.imageStorageUnavailable,
    unsupported: IMPORTANT_CONTENT_MESSAGES.imageUnsupported,
    tooLarge: IMPORTANT_CONTENT_MESSAGES.imageTooLarge,
    uploadFailed: IMPORTANT_CONTENT_MESSAGES.imageUploadFailed,
  })

/** A short-lived link to one image, for its uploader or anyone who can see an entry that names it. */
export const contentImageLink = (viewer: Viewer, ref: ContentImageRef): Promise<string | null> =>
  imageLink(CONTENT_IMAGES, viewer, ref, async (path) => Boolean(await ImportantContentModel.exists({ $and: [visibleTo(viewer), naming(path)] })))

/** After entries are deleted: removes the images they pointed at that no remaining entry names. */
export const removeUnusedImages = (descriptions: string[]): Promise<void> =>
  removeUnnamedImages(CONTENT_IMAGES, descriptions, async (path) => Boolean(await ImportantContentModel.exists(naming(path))), "an Important Content")
