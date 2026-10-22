import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { detectImageMimeType } from "@/lib/imageType"
import { ACCOUNT_PHOTOS, type AccountPhotoRef } from "@/lib/accountPhoto"
import { ACCOUNT_MESSAGES, ACCOUNT_PHOTO_MAX_BYTES } from "@/constants/account"
import { UserModel } from "@/models/User"
import { deleteObject, isStorageConfigured, presignDownload, putObject } from "@/services/storage/s3"
import type { Viewer } from "@/types/auth"

/**
 * An account's profile photo: stored in S3 like every other file here, with the account keeping only
 * the file's name (`photoFile`). The bytes come through the app, one request, type read from the
 * bytes and the key built here, exactly as the images inside a description are.
 *
 * It is the **person's** photo, so everything is keyed by `viewer.id` and not by `dataOwnerId`: a
 * child account has its own photo rather than wearing its parent's.
 *
 * A photo is an attachment, not a record: when it is replaced or removed, the object it leaves
 * behind is deleted afterwards and a storage failure there is logged rather than failing the change.
 */

/** Takes one account's photo out of storage. Never throws: nothing points at it any more. */
export async function forgetAccountPhoto(accountId: string, file: string | null | undefined): Promise<void> {
  const key = file ? ACCOUNT_PHOTOS.keyOf({ ownerId: accountId, file }) : null
  if (!key || !isStorageConfigured()) return
  try {
    await deleteObject(key)
  } catch (error: unknown) {
    console.warn("⚠️ Couldn't remove an account photo:", error instanceof Error ? error.message : error)
  }
}

/** Stores this account's photo in place of whatever it had, and answers the path the page shows it by. */
export async function setAccountPhoto(viewer: Viewer, bytes: Buffer): Promise<string> {
  if (!isStorageConfigured()) throw new UserFacingError(ACCOUNT_MESSAGES.photoStorageUnavailable)
  if (bytes.length === 0) throw new UserFacingError(ACCOUNT_MESSAGES.photoUnsupported)
  if (bytes.length > ACCOUNT_PHOTO_MAX_BYTES) throw new UserFacingError(ACCOUNT_MESSAGES.photoTooLarge)
  const type = detectImageMimeType(bytes)
  if (!type) throw new UserFacingError(ACCOUNT_MESSAGES.photoUnsupported)

  const ref: AccountPhotoRef = { ownerId: viewer.id, file: ACCOUNT_PHOTOS.fileOf(new mongoose.Types.ObjectId().toString(), type) }
  const key = ACCOUNT_PHOTOS.keyOf(ref)
  if (!key) throw new UserFacingError(ACCOUNT_MESSAGES.photoUploadFailed)
  // Stored first, so the account never names a photo that isn't there
  await putObject(key, bytes, type)
  await connectDatabase()
  const before = await UserModel.findOneAndUpdate({ _id: viewer.id }, { $set: { photoFile: ref.file } }, { projection: { photoFile: 1 } }).lean()
  if (!before) {
    await forgetAccountPhoto(viewer.id, ref.file)
    throw new UserFacingError(ACCOUNT_MESSAGES.gone)
  }
  await forgetAccountPhoto(viewer.id, before.photoFile)
  return ACCOUNT_PHOTOS.pathOf(ref)
}

/** Takes this account's photo off, so it shows its initials again. */
export async function clearAccountPhoto(viewer: Viewer): Promise<void> {
  await connectDatabase()
  const before = await UserModel.findOneAndUpdate({ _id: viewer.id }, { $set: { photoFile: null } }, { projection: { photoFile: 1 } }).lean()
  if (!before) throw new UserFacingError(ACCOUNT_MESSAGES.gone)
  await forgetAccountPhoto(viewer.id, before.photoFile)
}

/**
 * A short-lived link to a photo, or null when this account may not see it. An account sees its own
 * photo and no other, and only the file it really has now: an older or a guessed name is nothing.
 */
export async function accountPhotoLink(viewer: Viewer, ref: AccountPhotoRef): Promise<string | null> {
  const key = ACCOUNT_PHOTOS.keyOf(ref)
  const type = ACCOUNT_PHOTOS.typeOf(ref.file)
  if (!key || !type || !isStorageConfigured() || viewer.id !== ref.ownerId) return null
  await connectDatabase()
  const account = await UserModel.findById(ref.ownerId, { photoFile: 1 }).lean()
  return account?.photoFile === ref.file ? await presignDownload(key, type) : null
}
