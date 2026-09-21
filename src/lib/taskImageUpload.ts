"use client"

import { requestApi } from "@/lib/apiClient"
import { TASK_ATTACHMENT_MESSAGES, TASK_IMAGE_MAX_BYTES, TASK_IMAGE_TYPES, TASK_IMAGES_ENDPOINT } from "@/constants/taskAttachments"
import type { TaskImageView } from "@/types/taskAttachment"

/**
 * Sends one task image to the app, which stores it and answers what to save on the task, with a
 * short-lived link to show it from straight away. Through the app rather than straight to storage,
 * because the bucket refuses browser uploads from the live site. Daily Tasks and the employee plan
 * editor both upload this way.
 */
export async function uploadTaskImage(file: File, signal?: AbortSignal): Promise<TaskImageView> {
  // Checked here too, so a file the server would refuse never makes the trip
  if (!TASK_IMAGE_TYPES.includes(file.type)) throw new Error(TASK_ATTACHMENT_MESSAGES.unsupportedImage)
  if (file.size > TASK_IMAGE_MAX_BYTES) throw new Error(TASK_ATTACHMENT_MESSAGES.imageTooLarge)
  const { data } = await requestApi<TaskImageView>(
    TASK_IMAGES_ENDPOINT,
    { method: "POST", headers: { "Content-Type": file.type }, body: file, signal },
    // A repeat only stores another copy nothing points at, so a dropped request is safe to send again
    { retry: true }
  )
  return data
}
