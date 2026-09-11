"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { readSSEStream } from "@/lib/sse"
import { POST_COMMENT_REPLY_MESSAGES, type ReplyStage } from "@/constants/postCommentReplies"
import type { ApiEnvelope } from "@/types/api"
import type { GenerateReplyRequest, GeneratedReply, ReplyStreamEvent } from "@/types/postCommentReplies"

const GENERATE_ENDPOINT = "/api/post-comment-replies/generate"

export type ReplyGenerationStatus = "idle" | "loading" | "success" | "error"

// Only the selected post mode's value is sent; an empty post is simply left out
function toFormData(request: GenerateReplyRequest): FormData {
  const form = new FormData()
  form.append("context", request.context)
  form.append("style", request.style)
  form.append("comments", request.comments)
  if (request.targetComment) form.append("targetComment", JSON.stringify(request.targetComment))
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
export function usePostCommentReplyGenerator() {
  const [status, setStatus] = useState<ReplyGenerationStatus>("idle")
  const [stage, setStage] = useState<ReplyStage>("WRITING")
  const [result, setResult] = useState<GeneratedReply | null>(null)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  const generate = useCallback(async (request: GenerateReplyRequest) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setResult(null)
    setError(null)
    setStage(request.postMode === "image" && request.postImage ? "READING_POST" : "WRITING")
    setStatus("loading")

    try {
      const response = await fetch(GENERATE_ENDPOINT, {
        method: "POST",
        body: toFormData(request),
        signal: controller.signal,
      })
      if (!response.ok || !response.body) {
        // Validation failures come back as the standard JSON envelope with a user-safe message
        const body = (await response.json().catch(() => null)) as ApiEnvelope<never> | null
        setError(body?.message || POST_COMMENT_REPLY_MESSAGES.generationFailed)
        setStatus("error")
        return
      }

      let isFinished = false
      await readSSEStream<ReplyStreamEvent>(response.body, (event) => {
        if (event.status === "COMPLETE") {
          isFinished = true
          setResult(event.result)
          setStatus("success")
        } else if (event.status === "ERROR") {
          isFinished = true
          setError(event.message)
          setStatus("error")
        } else {
          setStage(event.status)
        }
      })
      if (!isFinished) throw new Error("Reply stream ended without a result")
    } catch (err: unknown) {
      if (controller.signal.aborted) return
      console.error("Post comment reply generation failed:", err)
      setError(POST_COMMENT_REPLY_MESSAGES.generationFailed)
      setStatus("error")
    }
  }, [])

  return { status, stage, result, error, generate }
}
