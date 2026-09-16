"use client"

import { readSSEStream } from "@/lib/sse"
import { fetchWithRetry } from "@/lib/apiClient"
import { createToolStore, useToolStore } from "@/lib/toolStore"
import { COMMENT_WRITER_MESSAGES, type CommentTuneId } from "@/constants/commentWriter"
import type { PostInputMode } from "@/constants/postInput"
import type { ApiEnvelope } from "@/types/api"
import type { CommentStage, CommentStreamEvent, GeneratedComment } from "@/types/commentWriter"

const GENERATE_ENDPOINT = "/api/comment-writer/generate"

export type CommentWriterStatus = "idle" | "loading" | "success" | "error"

export interface CommentStageEntry {
  status: CommentStage
  text: string
}

export interface CommentRequest {
  tune: CommentTuneId
  mode: PostInputMode
  postText: string
  image: File | null
}

interface CommentGenerationState {
  status: CommentWriterStatus
  result: GeneratedComment | null
  stages: CommentStageEntry[]
  error: string | null
}

const IDLE: CommentGenerationState = { status: "idle", result: null, stages: [], error: null }

// Lives outside the page, so a comment (or one still being written) is there when the user comes back
const store = createToolStore<CommentGenerationState>("comment-writer:result", IDLE, {
  version: 1,
  // Only a finished comment survives a refresh; a running request can't resume after one
  toStored: (state) => (state.status === "success" ? { ...state, stages: [] } : IDLE),
  activity: { href: "/comment-writer", statusOf: (state) => state.status },
})
let controller: AbortController | null = null

function toFormData({ tune, mode, postText, image }: CommentRequest): FormData {
  const form = new FormData()
  form.append("tune", tune)
  form.append("inputMode", mode)
  if (mode === "text") form.append("postText", postText)
  if (mode === "image" && image) form.append("image", image)
  return form
}

/**
 * Generates one comment at a time and follows the real backend stages as they stream in.
 * Starting a generation clears the previous comment immediately and cancels any request
 * still running, so an old comment is never shown alongside a new one.
 */
async function generate(request: CommentRequest) {
  controller?.abort()
  const current = new AbortController()
  controller = current
  const fail = (message: string) => store.update({ status: "error", error: message })
  store.update({ status: "loading", result: null, stages: [], error: null })

  try {
    // Retried only until the stream starts; a stream that has begun is never repeated
    const response = await fetchWithRetry(GENERATE_ENDPOINT, { method: "POST", body: toFormData(request), signal: current.signal }, { retry: true })
    if (!response.ok || !response.body) {
      // Validation failures come back as JSON with a user-safe message
      const body = (await response.json().catch(() => null)) as ApiEnvelope<never> | null
      if (!current.signal.aborted) fail(body?.message || COMMENT_WRITER_MESSAGES.generationFailed)
      return
    }

    let isFinished = false
    await readSSEStream<CommentStreamEvent>(response.body, (event) => {
      if (current.signal.aborted) return
      if (event.status === "COMPLETE") {
        isFinished = true
        store.update({ status: "success", result: event.result })
      } else if (event.status === "ERROR") {
        isFinished = true
        fail(event.message)
      } else {
        store.update(({ stages }) => ({ stages: [...stages, { status: event.status, text: event.text }] }))
      }
    })
    if (!isFinished && !current.signal.aborted) throw new Error("Comment stream ended without a result")
  } catch (err: unknown) {
    if (current.signal.aborted) return
    console.error("Comment generation failed:", err)
    fail(COMMENT_WRITER_MESSAGES.generationFailed)
  }
}

// Cancels any running request and clears the comment
function reset() {
  controller?.abort()
  controller = null
  store.reset()
}

export function useCommentGenerator() {
  const { status, result, stages, error } = useToolStore(store)
  return { status, result, stages, error, generate, reset }
}
