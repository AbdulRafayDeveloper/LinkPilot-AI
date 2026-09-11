"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { readSSEStream } from "@/lib/sse"
import { readStoredTrendingResult, saveTrendingResult, subscribeToStoredTrendingResult } from "@/lib/trendingResultStore"
import { TRENDING_ERROR_MESSAGE, TRENDING_TOPIC_COUNT } from "@/constants/trending"
import type { TrendingResult, TrendingStage, TrendingStreamEvent } from "@/services/trending/schema"

export type TrendingSearchStatus = "idle" | "loading" | "success" | "partial_success" | "error"

export interface TrendingStageEntry {
  status: TrendingStage
  text: string
}

const statusFor = (result: TrendingResult): TrendingSearchStatus =>
  result.topics.length >= TRENDING_TOPIC_COUNT ? "success" : "partial_success"

/**
 * Drives one fresh Trending Topics search at a time. Starting a search clears the
 * previous results immediately, so old topics never stay on screen under new ones.
 * The last successful results are kept in the browser for 24 hours: until a new search
 * replaces them, they come back after navigating away or refreshing.
 */
export function useTrendingTopicsSearch() {
  const [status, setStatus] = useState<TrendingSearchStatus>("idle")
  const [result, setResult] = useState<TrendingResult | null>(null)
  const [stages, setStages] = useState<TrendingStageEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const stored = useSyncExternalStore(subscribeToStoredTrendingResult, readStoredTrendingResult, () => null)

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
          saveTrendingResult(event.result)
          setResult(event.result)
          setStatus(statusFor(event.result))
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

  // Before any search on this visit, show the results kept from the last one
  if (status === "idle" && stored) {
    return { status: statusFor(stored.result), result: stored.result, stages, error, search }
  }
  return { status, result, stages, error, search }
}
