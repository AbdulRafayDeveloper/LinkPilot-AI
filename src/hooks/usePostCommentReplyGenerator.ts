"use client"

import { readSSEStream } from "@/lib/sse"
import { fetchWithRetry } from "@/lib/apiClient"
import { createToolStore, useToolStore } from "@/lib/toolStore"
import { POST_COMMENT_REPLY_MESSAGES, type ReplyStage } from "@/constants/postCommentReplies"
import type { ApiEnvelope } from "@/types/api"
import type { GenerateReplyRequest, GeneratedReply, ReplyStreamEvent } from "@/types/postCommentReplies"

const GENERATE_ENDPOINT = "/api/post-comment-replies/generate"

export type ReplyGenerationStatus = "idle" | "loading" | "success" | "error"

interface ReplyGenerationState {
  status: ReplyGenerationStatus
  stage: ReplyStage
  result: GeneratedReply | null
  error: string | null
}

const IDLE: ReplyGenerationState = { status: "idle", stage: "WRITING", result: null, error: null }

// Lives outside the page, so a reply (or one still being written) is there when the user comes back
const store = createToolStore<ReplyGenerationState>("post-comment-replies:result", IDLE, {
  version: 1,
  // Only a finished reply survives a refresh; a running request can't resume after one
  toStored: (state) => (state.status === "success" ? state : IDLE),
  activity: { href: "/post-comment-replies", statusOf: (state) => state.status },
})
let controller: AbortController | null = null

// Only the selected post mode's value is sent; an empty post is simply left out
function toFormData(request: GenerateReplyRequest): FormData {
  const form = new FormData()
  form.append("context", request.context)
  form.append("style", request.style)
  form.append("comments", request.comments)
  form.append("inputMode", request.postMode)
  if (request.postMode === "text" && request.postText.trim()) form.append("postText", request.postText)
  if (request.postMode === "image" && request.postImage) form.append("image", request.postImage)
  return form
}

/**
 * Generates one reply at a time and follows the real pipeline stage as it streams in.
 * Starting a generation cancels the previous one and clears its reply immediately, so
 * an old reply is never shown alongside a new one.
 */
async function generate(request: GenerateReplyRequest) {
  controller?.abort()
  const current = new AbortController()
  controller = current
  const fail = (message: string) => store.update({ status: "error", error: message })
  store.update({
    status: "loading",
    stage: request.postMode === "image" && request.postImage ? "READING_POST" : "WRITING",
    result: null,
    error: null,
  })

  try {
    // Retried only until the stream starts; a stream that has begun is never repeated
    const response = await fetchWithRetry(GENERATE_ENDPOINT, { method: "POST", body: toFormData(request), signal: current.signal }, { retry: true })
    if (!response.ok || !response.body) {
      // Validation failures come back as the standard JSON envelope with a user-safe message
      const body = (await response.json().catch(() => null)) as ApiEnvelope<never> | null
      if (!current.signal.aborted) fail(body?.message || POST_COMMENT_REPLY_MESSAGES.generationFailed)
      return
    }

    let isFinished = false
    await readSSEStream<ReplyStreamEvent>(response.body, (event) => {
      if (current.signal.aborted) return
      if (event.status === "COMPLETE") {
        isFinished = true
        store.update({ status: "success", result: event.result })
      } else if (event.status === "ERROR") {
        isFinished = true
        fail(event.message)
      } else {
        store.update({ stage: event.status })
      }
    })
    if (!isFinished && !current.signal.aborted) throw new Error("Reply stream ended without a result")
  } catch (err: unknown) {
    if (current.signal.aborted) return
    console.error("Post comment reply generation failed:", err)
    fail(POST_COMMENT_REPLY_MESSAGES.generationFailed)
  }
}

// Cancels any running request and clears the reply
function reset() {
  controller?.abort()
  controller = null
  store.reset()
}

export function usePostCommentReplyGenerator() {
  const { status, stage, result, error } = useToolStore(store)
  return { status, stage, result, error, generate, reset }
}
