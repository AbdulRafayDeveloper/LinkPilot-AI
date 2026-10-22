import { defineStoredImages, type StoredImageRef, type StoredImageType } from "./storedImages"
import { ACCOUNT_ENDPOINTS } from "@/constants/account"

/**
 * An account's own profile photo: `/api/account/photo/<account>/<file>`, one folder per account in
 * storage. The naming is the shared one (lib/storedImages.ts), which is exactly what a photo needs
 * too: the account is in the path, so the route can check it without a record of its own, and the
 * file is an id the server made plus the type it read from the bytes, so nothing the browser sends
 * decides where a photo is stored. A fresh id on every upload also means the browser never shows a
 * cached copy of the photo that was replaced.
 *
 * The path is the app's own route rather than storage, because the bucket is private and a signed
 * link stops working after fifteen minutes; the route hands out a new one each time.
 */
export const ACCOUNT_PHOTOS = defineStoredImages(ACCOUNT_ENDPOINTS.photo, "LinkPilot/account-photos")

export type AccountPhotoRef = StoredImageRef
export type AccountPhotoType = StoredImageType

export const accountPhotoPath = ACCOUNT_PHOTOS.pathOf
export const accountPhotoFile = ACCOUNT_PHOTOS.fileOf
export const accountPhotoKey = ACCOUNT_PHOTOS.keyOf
export const accountPhotoType = ACCOUNT_PHOTOS.typeOf
