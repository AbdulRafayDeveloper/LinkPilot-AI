"use client"

import { requestApi } from "@/lib/apiClient"
import { STORED_IMAGE_EXTENSIONS } from "@/lib/storedImages"
import { ACCOUNT_ENDPOINTS, ACCOUNT_MESSAGES, ACCOUNT_PHOTO_MAX_BYTES } from "@/constants/account"

/**
 * Sends one profile photo to the app, which stores it and answers the path to show it by. Through
 * the app rather than straight to storage, because the bucket refuses browser uploads from the live
 * site, exactly as a task's images and an Important Content description's images go.
 */

export const ACCOUNT_PHOTO_TYPES: string[] = Object.keys(STORED_IMAGE_EXTENSIONS)

export async function uploadAccountPhoto(file: File, signal?: AbortSignal): Promise<string> {
  // Checked here too, so a file the server would refuse never makes the trip
  if (!ACCOUNT_PHOTO_TYPES.includes(file.type)) throw new Error(ACCOUNT_MESSAGES.photoUnsupported)
  if (file.size > ACCOUNT_PHOTO_MAX_BYTES) throw new Error(ACCOUNT_MESSAGES.photoTooLarge)
  const { data } = await requestApi<{ photo: string }>(
    ACCOUNT_ENDPOINTS.photo,
    { method: "POST", headers: { "Content-Type": file.type }, body: file, signal },
    // A repeat replaces the photo with the same photo, so a dropped request is safe to send again
    { retry: true }
  )
  return data.photo
}

export async function removeAccountPhoto(): Promise<void> {
  await requestApi<{ photo: null }>(ACCOUNT_ENDPOINTS.photo, { method: "DELETE" }, { retry: true })
}
