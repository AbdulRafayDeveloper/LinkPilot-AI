"use client"

import { readSSEStream } from "@/lib/sse"
import { createToolStore, useToolStore } from "@/lib/toolStore"
import { TRENDING_ERROR_MESSAGE, TRENDING_TOPIC_COUNT } from "@/constants/trending"
import type { TrendingResult, TrendingStage, TrendingStreamEvent } from "@/services/trending/schema"

export type TrendingSearchStatus = "idle" | "loading" | "success" | "partial_success" | "error"

export interface TrendingStageEntry {
  status: TrendingStage
  text: string
}

interface TrendingSearchState {
  status: TrendingSearchStatus
  result: TrendingResult | null
  stages: TrendingStageEntry[]
  error: string | null
}

const IDLE: TrendingSearchState = { status: "idle", result: null, stages: [], error: null }

const isFinished = (status: TrendingSearchStatus) => status === "success" || status === "partial_success"

/**
 * The last search lives outside the page: its topics (or a search still running) are
 * there after visiting another tool, and finished topics survive refreshes for 24 hours
 * until a new search replaces them. Bump the version when TrendingResult changes shape.
 */
const store = createToolStore<TrendingSearchState>("trending-topics:result", IDLE, {
  version: 1,
  toStored: (state) => (isFinished(state.status) ? { ...state, stages: [] } : IDLE),
})
let controller: AbortController | null = null

/**
 * Runs one fresh search at a time. Starting a search clears the previous results
 * immediately, so old topics never stay on screen under new ones.
 */
async function search() {
  controller?.abort()
  const current = new AbortController()
  controller = current
  store.update({ status: "loading", result: null, stages: [], error: null })

  try {
    const response = await fetch("/api/trending-topics/search", { method: "POST", signal: current.signal })
    if (!response.ok || !response.body) throw new Error(`Search request failed with status ${response.status}`)

    let hasResult = false
    await readSSEStream<TrendingStreamEvent>(response.body, (event) => {
      if (current.signal.aborted) return
      if (event.status === "COMPLETE") {
        hasResult = true
        store.update({
          status: event.result.topics.length >= TRENDING_TOPIC_COUNT ? "success" : "partial_success",
          result: event.result,
        })
      } else if (event.status === "ERROR") {
        hasResult = true
        store.update({ status: "error", error: event.message })
      } else {
        store.update(({ stages }) => ({ stages: [...stages, { status: event.status, text: event.text }] }))
      }
    })
    if (!hasResult && !current.signal.aborted) throw new Error("Search stream ended without a result")
  } catch (err: unknown) {
    if (current.signal.aborted) return
    console.error("Trending topics search failed:", err)
    store.update({ status: "error", error: TRENDING_ERROR_MESSAGE })
  }
}

// Cancels a running search and clears the topics
function reset() {
  controller?.abort()
  controller = null
  store.reset()
}

export function useTrendingTopicsSearch() {
  const { status, result, stages, error } = useToolStore(store)
  return { status, result, stages, error, search, reset }
}
