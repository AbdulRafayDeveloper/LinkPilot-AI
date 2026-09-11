"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { readSSEStream } from "@/lib/sse"
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
export function useCommentGenerator() {
  const [status, setStatus] = useState<CommentWriterStatus>("idle")
  const [result, setResult] = useState<GeneratedComment | null>(null)
  const [stages, setStages] = useState<CommentStageEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  const fail = useCallback((message: string) => {
    setError(message)
    setStatus("error")
  }, [])

  const generate = useCallback(
    async (request: CommentRequest) => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller

      setResult(null)
      setStages([])
      setError(null)
      setStatus("loading")

      try {
        const response = await fetch(GENERATE_ENDPOINT, {
          method: "POST",
          body: toFormData(request),
          signal: controller.signal,
        })
        if (!response.ok || !response.body) {
          // Validation failures come back as JSON with a user-safe message
          const body = (await response.json().catch(() => null)) as ApiEnvelope<never> | null
          fail(body?.message || COMMENT_WRITER_MESSAGES.generationFailed)
          return
        }

        let isFinished = false
        await readSSEStream<CommentStreamEvent>(response.body, (event) => {
          if (event.status === "COMPLETE") {
            isFinished = true
            setResult(event.result)
            setStatus("success")
          } else if (event.status === "ERROR") {
            isFinished = true
            fail(event.message)
          } else {
            setStages((previous) => [...previous, { status: event.status, text: event.text }])
          }
        })
        if (!isFinished) throw new Error("Comment stream ended without a result")
      } catch (err: unknown) {
        if (controller.signal.aborted) return
        console.error("Comment generation failed:", err)
        fail(COMMENT_WRITER_MESSAGES.generationFailed)
      }
    },
    [fail]
  )

  return { status, result, stages, error, generate }
}
