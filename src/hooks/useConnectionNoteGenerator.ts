"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { requestApi } from "@/lib/apiClient"
import { CONNECTION_NOTE_MESSAGES, type ConnectionNoteToneId } from "@/constants/connectionNote"
import type { GeneratedConnectionNote } from "@/types/connectionNote"

export type ConnectionNoteStatus = "idle" | "loading" | "success" | "error"

/**
 * Generates one note at a time. Starting a generation clears the previous note
 * immediately, so an old note is never shown alongside a new one.
 */
export function useConnectionNoteGenerator() {
  const [status, setStatus] = useState<ConnectionNoteStatus>("idle")
  const [result, setResult] = useState<GeneratedConnectionNote | null>(null)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  const generate = useCallback(async (profileData: string, tone: ConnectionNoteToneId) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setResult(null)
    setError(null)
    setStatus("loading")

    try {
      const { data } = await requestApi<GeneratedConnectionNote>("/api/connection-notes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileData, tone }),
        signal: controller.signal,
      })
      setResult(data)
      setStatus("success")
    } catch (err: unknown) {
      if (controller.signal.aborted) return
      // Network failures surface as TypeError; server errors carry a user-safe message
      const message = err instanceof Error && !(err instanceof TypeError) ? err.message : ""
      setError(message || CONNECTION_NOTE_MESSAGES.generationFailed)
      setStatus("error")
    }
  }, [])

  return { status, result, error, generate }
}
