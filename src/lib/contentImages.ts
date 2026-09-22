import { defineStoredImages, STORED_IMAGE_EXTENSIONS, type StoredImageRef, type StoredImageType } from "./storedImages"

/**
 * Images inside an Important Content description, served by `/api/important-content/images` and kept
 * in one storage folder per account. How they are named is lib/storedImages.ts, shared with Quick Notes.
 */
export const CONTENT_IMAGES = defineStoredImages("/api/important-content/images", "LinkPilot/important-content")

export const CONTENT_IMAGES_ENDPOINT = CONTENT_IMAGES.endpoint
export const CONTENT_IMAGE_KEY_PREFIX = CONTENT_IMAGES.keyPrefix
export const CONTENT_IMAGE_EXTENSIONS = STORED_IMAGE_EXTENSIONS
export type ContentImageType = StoredImageType
export type ContentImageRef = StoredImageRef

export const contentImagePath = CONTENT_IMAGES.pathOf
export const contentImageFile = CONTENT_IMAGES.fileOf
export const contentImageKey = CONTENT_IMAGES.keyOf
export const contentImageType = CONTENT_IMAGES.typeOf
export const contentImagesIn = CONTENT_IMAGES.imagesIn
