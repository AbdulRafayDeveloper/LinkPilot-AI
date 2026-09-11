"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { requestApi } from "@/lib/apiClient"

export type GenerationStatus = "idle" | "loading" | "success" | "error"

/**
 * Runs one generation request at a time against a JSON API route. Starting a new
 * request cancels the previous one and clears its result immediately, so an old result
 * is never shown alongside a new one.
 */
export function useGenerationRequest<TPayload, TResult>(endpoint: string, fallbackError: string) {
  const [status, setStatus] = useState<GenerationStatus>("idle")
  const [result, setResult] = useState<TResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  const generate = useCallback(
    async (payload: TPayload) => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller

      setResult(null)
      setError(null)
      setStatus("loading")

      try {
        const { data } = await requestApi<TResult>(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
        setResult(data)
        setStatus("success")
      } catch (err: unknown) {
        if (controller.signal.aborted) return
        // Network failures surface as TypeError; server errors carry a user-safe message
        const message = err instanceof Error && !(err instanceof TypeError) ? err.message : ""
        setError(message || fallbackError)
        setStatus("error")
      }
    },
    [endpoint, fallbackError]
  )

  // Cancels any in-flight request and returns to the idle state, e.g. when the form is cleared
  const reset = useCallback(() => {
    controllerRef.current?.abort()
    setResult(null)
    setError(null)
    setStatus("idle")
  }, [])

  return { status, result, error, generate, reset }
}
