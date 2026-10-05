"use client"

import { requestApi } from "@/lib/apiClient"
import {
  ACCEPTED_CONTENT_TYPES,
  PROJECT_TASK_MESSAGES,
  maxBytesFor,
} from "@/constants/clientProjectTasks"
import { categoryForContentType } from "@/constants/importantFiles"
import type { ProjectFileProgress, ProjectFileUploadPlan, ProjectFileView } from "@/types/clientProjectTasks"

/**
 * Sending one file up to a client project, in chunks, through the app.
 *
 * Three steps, and the browser drives all three: ask what to do (`POST`), send each chunk
 * (`PUT ?index=`), then tell the server to join them (`POST` again, over and over while it says it
 * has not finished). It is the same shape as a meeting recording's upload, for the same two
 * reasons: a serverless request body is capped at 4.5 MB, and the bucket refuses browser uploads
 * straight to storage from the live site.
 *
 * The caller passes the base address, so one function serves a signed-in page and a project's
 * shared link, which reach the same service by different doors.
 */

/** Whether the app can take this file at all, checked here so a doomed upload never starts. */
export function fileProblem(file: File): string | null {
  const category = categoryForContentType(file.type)
  // The list is a tuple of the exact types, so it is read as plain strings to ask about one
  if (!category || !(ACCEPTED_CONTENT_TYPES as readonly string[]).includes(file.type)) return PROJECT_TASK_MESSAGES.fileUnsupported
  if (file.size <= 0 || file.size > maxBytesFor(category)) return PROJECT_TASK_MESSAGES.fileTooLarge
  return null
}

interface UploadOptions {
  // Where the file's own routes live: `/api/client-projects/<id>/files`, or the shared link's
  endpoint: string
  // How far it has got, from 0 to 1, for a bar the person can watch
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

/**
 * Sends one file and answers it as an item may name it. It throws what went wrong, in words the
 * page can show, and leaves nothing on the item: the file is only ever attached by saving the item
 * with what this returned.
 */
export async function uploadProjectFile(file: File, { endpoint, onProgress, signal }: UploadOptions): Promise<ProjectFileView> {
  const problem = fileProblem(file)
  if (problem) throw new Error(problem)

  const { data: plan } = await requestApi<ProjectFileUploadPlan>(
    endpoint,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, contentType: file.type, size: file.size }), signal },
    // Nothing is stored by planning, so a dropped request is safe to send again
    { retry: true }
  )

  // Sending is half the work and joining the other half, as far as the bar is concerned
  const report = (fraction: number) => onProgress?.(Math.max(0, Math.min(1, fraction)))
  for (let index = 0; index < plan.chunks; index++) {
    const from = index * plan.chunkBytes
    const chunk = file.slice(from, Math.min(from + plan.chunkBytes, file.size))
    await requestApi(
      `${endpoint}/${plan.assetId}?index=${index}`,
      { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: chunk, signal },
      // The same chunk twice lands on the same key, so a dropped one is sent again rather than lost
      { retry: true }
    )
    report(((index + 1) / plan.chunks) * 0.5)
  }

  // Joining is resumable and bounded, so it is asked for again until it says it has finished
  for (;;) {
    const { data } = await requestApi<ProjectFileProgress>(
      `${endpoint}/${plan.assetId}`,
      { method: "POST", signal },
      { retry: true }
    )
    if (data.done && data.file) {
      report(1)
      return data.file
    }
    if (data.done) throw new Error(PROJECT_TASK_MESSAGES.fileUploadFailed)
    report(0.5 + (data.totalBytes > 0 ? (data.joinedBytes / data.totalBytes) * 0.5 : 0))
  }
}
