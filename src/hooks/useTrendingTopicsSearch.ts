"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { readSSEStream } from "@/lib/sse"
import { TRENDING_ERROR_MESSAGE, TRENDING_TOPIC_COUNT } from "@/constants/trending"
import type { TrendingResult, TrendingStage, TrendingStreamEvent } from "@/services/trending/schema"

export type TrendingSearchStatus = "idle" | "loading" | "success" | "partial_success" | "error"

export interface TrendingStageEntry {
  status: TrendingStage
  text: string
}

/**
 * Drives one fresh Trending Topics search at a time. Starting a search clears the
 * previous results immediately, so old topics never stay on screen under new ones.
 */
export function useTrendingTopicsSearch() {
  const [status, setStatus] = useState<TrendingSearchStatus>("idle")
  const [result, setResult] = useState<TrendingResult | null>(null)
  const [stages, setStages] = useState<TrendingStageEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  const search = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setResult(null)
    setStages([])
    setError(null)
    setStatus("loading")

    try {
      const response = await fetch("/api/trending-topics/search", { method: "POST", signal: controller.signal })
      if (!response.ok || !response.body) throw new Error(`Search request failed with status ${response.status}`)

      let isFinished = false
      await readSSEStream<TrendingStreamEvent>(response.body, (event) => {
        if (event.status === "COMPLETE") {
          isFinished = true
          setResult(event.result)
          setStatus(event.result.topics.length >= TRENDING_TOPIC_COUNT ? "success" : "partial_success")
        } else if (event.status === "ERROR") {
          isFinished = true
          setError(event.message)
          setStatus("error")
        } else {
          setStages((previous) => [...previous, { status: event.status, text: event.text }])
        }
      })
      if (!isFinished) throw new Error("Search stream ended without a result")
    } catch (err: unknown) {
      if (controller.signal.aborted) return
      console.error("Trending topics search failed:", err)
      setError(TRENDING_ERROR_MESSAGE)
      setStatus("error")
    }
  }, [])

  return { status, result, stages, error, search }
}
