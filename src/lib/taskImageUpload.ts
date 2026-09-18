"use client"

import { fetchWithRetry, requestApi } from "@/lib/apiClient"
import { TASK_ATTACHMENT_MESSAGES, TASK_IMAGES_ENDPOINT } from "@/constants/taskAttachments"
import type { TaskImage } from "@/types/taskAttachment"

/**
 * Sends one task image from the browser straight to storage: the app hands out a signed link, the
 * bytes go to S3, and what comes back is only the id to save on the task. The same two steps a
 * brand photo takes (`components/post-images/BrandSettingsDialog`), kept here so Daily Tasks and
 * the employee plan editor both upload the same way.
 */
export async function uploadTaskImage(file: File, signal?: AbortSignal): Promise<TaskImage> {
  const { data } = await requestApi<{ assetId: string; url: string }>(
    TASK_IMAGES_ENDPOINT,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: file.type, size: file.size }),
      signal,
    },
    // Asking for a link saves nothing, so a dropped request is safe to send again
    { retry: true }
  )

  // Straight to storage, retried on a dropped connection the way every other upload here is
  const put = await fetchWithRetry(data.url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
    signal,
  })
  if (!put.ok) throw new Error(TASK_ATTACHMENT_MESSAGES.uploadFailed)

  return { assetId: data.assetId, contentType: file.type }
}
