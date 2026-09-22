import { escapeForSearch } from "@/lib/listQuery"
import { NOTE_IMAGES } from "@/lib/noteImages"
import type { StoredImageRef } from "@/lib/storedImages"
import { NOTE_IMAGE_MAX_BYTES, QUICK_NOTES_MESSAGES } from "@/constants/quickNotes"
import { QuickNote } from "@/models/QuickNote"
import { imageLink, removeUnnamedImages, storeImage } from "@/services/storage/storedImages"
import { visibleTo } from "@/services/auth/viewer"
import type { Viewer } from "@/types/auth"

/**
 * The images inside Quick Notes (lib/noteImages.ts says how they are named, services/storage/
 * storedImages.ts how they are stored, shown and removed). An image is an attachment of the notes
 * that name it: it goes with the last of them, never on its own.
 */

// The notes that name an image, by its path, whose file is an id no other image shares
const naming = (path: string) => ({ content: { $regex: escapeForSearch(path) } })

/** Stores one image for this account and answers the path a note names it by. */
export const storeNoteImage = (viewer: Viewer, bytes: Buffer): Promise<string> =>
  storeImage(NOTE_IMAGES, viewer, bytes, NOTE_IMAGE_MAX_BYTES, {
    storageUnavailable: QUICK_NOTES_MESSAGES.imageStorageUnavailable,
    unsupported: QUICK_NOTES_MESSAGES.imageUnsupported,
    tooLarge: QUICK_NOTES_MESSAGES.imageTooLarge,
    uploadFailed: QUICK_NOTES_MESSAGES.imageUploadFailed,
  })

/** A short-lived link to one image, for its uploader or anyone who can see a note that names it. */
export const noteImageLink = (viewer: Viewer, ref: StoredImageRef): Promise<string | null> =>
  imageLink(NOTE_IMAGES, viewer, ref, async (path) => Boolean(await QuickNote.exists({ $and: [visibleTo(viewer), naming(path)] })))

/** After notes are deleted: removes the images they named that no remaining note names. */
export const removeUnusedNoteImages = (contents: string[]): Promise<void> =>
  removeUnnamedImages(NOTE_IMAGES, contents, async (path) => Boolean(await QuickNote.exists(naming(path))), "a Quick Notes")

// Only notes that name an image are read before a delete, so deleting plain notes costs nothing extra
export const NAMES_AN_IMAGE = { content: { $regex: escapeForSearch(`${NOTE_IMAGES.endpoint}/`) } }
