"use client"

import { requestApi } from "@/lib/apiClient"
import { withRetry } from "@/lib/retry"
import {
  IMPORTANT_FILES_ENDPOINT,
  IMPORTANT_FILES_MESSAGES,
  UPLOAD_PART_RETRIES,
} from "@/constants/importantFiles"
import type { Asset, UploadPlan, UploadRequest } from "@/types/importantFiles"

/**
 * Sends one file from the browser straight to S3, with links signed by the app.
 *
 * The app only ever sees the small JSON either side of the upload: the plan, and then the word
 * that every part has landed. The bytes go to S3 over XHR, which is what reports progress, and
 * a part that fails is sent again before the whole upload gives up. Cancelling, or a failure
 * that cannot be recovered, tells the app to throw away what was started so nothing is left
 * half-uploaded.
 */

interface UploadHandlers {
  // 0 to 100, from the bytes S3 has accepted
  onProgress: (percent: number) => void
  onStage: (stage: "preparing" | "uploading" | "finishing") => void
  signal: AbortSignal
}

// S3 answers these when trying again may work: a timeout, throttling or a problem on its side
const RETRYABLE_STORAGE_STATUS = new Set([408, 429, 500, 502, 503, 504])

/** A failed PUT, with the status S3 answered (0 when the connection dropped before any answer). */
class StorageUploadError extends Error {
  constructor(readonly status: number) {
    super(status === 0 ? "The connection to storage dropped" : `Storage refused the upload (${status})`)
  }
}

/** One PUT to a signed URL, with progress. Resolves only when S3 has taken the bytes. */
function putToStorage(url: string, body: Blob, contentType: string, onBytes: (bytes: number) => void, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    const abort = () => request.abort()
    request.open("PUT", url, true)
    request.setRequestHeader("Content-Type", contentType)
    request.upload.onprogress = (event) => onBytes(event.loaded)
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new StorageUploadError(request.status))
    request.onerror = () => reject(new StorageUploadError(0))
    request.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"))
    signal.addEventListener("abort", abort, { once: true })
    request.onloadend = () => signal.removeEventListener("abort", abort)
    request.send(body)
  })
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError"

/**
 * Sends one part (or a whole small file), trying again with backoff after a dropped connection or an
 * answer that may change (lib/retry.ts). A refusal that won't change, such as an expired link, and a
 * cancellation fail at once. Every attempt PUTs the same bytes to the same key, so a repeat is safe.
 */
async function sendPart(
  url: string,
  body: Blob,
  contentType: string,
  onBytes: (bytes: number) => void,
  signal: AbortSignal
): Promise<void> {
  await withRetry(
    async (attempt) => {
      // A retried part starts again from nothing, so its progress does too
      if (attempt > 0) onBytes(0)
      await putToStorage(url, body, contentType, onBytes, signal)
    },
    {
      retries: UPLOAD_PART_RETRIES,
      signal,
      shouldRetry: (error) => !isAbort(error) && error instanceof StorageUploadError && (error.status === 0 || RETRYABLE_STORAGE_STATUS.has(error.status)),
    }
  )
}

/** Tells the app to abort the multipart upload and drop the record it made. */
async function giveUp(assetId: string): Promise<void> {
  await requestApi(`${IMPORTANT_FILES_ENDPOINT}/uploads/${assetId}`, { method: "DELETE" }).catch(() => undefined)
}

/**
 * Registers the file, uploads it, and returns it as the module will list it. Anything that goes
 * wrong along the way leaves nothing behind in the collection or in the bucket.
 */
export async function uploadAsset(
  file: File,
  metadata: { name: string; description: string },
  { onProgress, onStage, signal }: UploadHandlers
): Promise<Asset> {
  onStage("preparing")
  const request: UploadRequest = {
    ...metadata,
    originalName: file.name,
    contentType: file.type,
    size: file.size,
  }
  const { data: plan } = await requestApi<UploadPlan>(`${IMPORTANT_FILES_ENDPOINT}/uploads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  }, { idempotent: true })

  try {
    onStage("uploading")
    if (plan.mode === "single") {
      await sendPart(plan.url, file, file.type, (bytes) => onProgress(Math.round((bytes / file.size) * 100)), signal)
    } else {
      // Every part's own progress is kept, so the total never jumps backwards on a retry
      const sent = new Array<number>(plan.urls.length).fill(0)
      const report = () => onProgress(Math.min(99, Math.round((sent.reduce((a, b) => a + b, 0) / file.size) * 100)))
      for (const [index, part] of plan.urls.entries()) {
        const start = index * plan.partSize
        const chunk = file.slice(start, Math.min(start + plan.partSize, file.size))
        await sendPart(
          part.url,
          chunk,
          file.type,
          (bytes) => {
            sent[index] = bytes
            report()
          },
          signal
        )
        sent[index] = chunk.size
        report()
      }
    }

    onStage("finishing")
    const { data: asset } = await requestApi<Asset>(`${IMPORTANT_FILES_ENDPOINT}/uploads/${plan.assetId}`, {
      method: "POST",
    }, { retry: true })
    onProgress(100)
    return asset
  } catch (error: unknown) {
    await giveUp(plan.assetId)
    if (isAbort(error) || signal.aborted) throw new DOMException("Upload cancelled", "AbortError")
    throw error instanceof Error ? error : new Error(IMPORTANT_FILES_MESSAGES.uploadFailed)
  }
}
