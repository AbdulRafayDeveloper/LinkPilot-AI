"use client"

import { requestApi } from "@/lib/apiClient"
import { NOTE_IMAGES } from "@/lib/noteImages"
import { NOTE_IMAGE_ACCEPT, NOTE_IMAGE_MAX_BYTES, QUICK_NOTES_MESSAGES } from "@/constants/quickNotes"
import type { RichTextImages } from "@/components/ui/RichTextEditor"

/** Stores one picture through the app and answers the address the note names it by. */
async function uploadNoteImage(file: File): Promise<string> {
  const { data } = await requestApi<{ src: string }>(
    NOTE_IMAGES.endpoint,
    { method: "POST", headers: { "Content-Type": file.type }, body: file },
    // A repeat only stores another copy nothing points at, so a dropped request is safe to send again
    { retry: true }
  )
  return data.src
}

/**
 * Pictures in a Quick Note, for the shared RichTextEditor: the same limits the server holds them to,
 * so a file it would refuse never makes the trip. Used by the save box and by the edit dialog.
 */
export const NOTE_EDITOR_IMAGES: RichTextImages = {
  accept: NOTE_IMAGE_ACCEPT,
  maxBytes: NOTE_IMAGE_MAX_BYTES,
  upload: uploadNoteImage,
  messages: {
    unsupported: QUICK_NOTES_MESSAGES.imageUnsupported,
    tooLarge: QUICK_NOTES_MESSAGES.imageTooLarge,
    failed: QUICK_NOTES_MESSAGES.imageUploadFailed,
    badAddress: QUICK_NOTES_MESSAGES.imageBadAddress,
  },
}
