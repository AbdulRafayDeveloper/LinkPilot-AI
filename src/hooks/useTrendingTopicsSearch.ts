"use client"

import { readSSEStream } from "@/lib/sse"
import { requestApi } from "@/lib/apiClient"
import { createToolStore, useToolStore } from "@/lib/toolStore"
import { TRENDING_ERROR_MESSAGE, TRENDING_MESSAGES, TRENDING_TOPIC_COUNT } from "@/constants/trending"
import type { TrendingResult, TrendingStage, TrendingStreamEvent } from "@/services/trending/schema"

const SEARCH_ENDPOINT = "/api/trending-topics/search"
const SAVED_ENDPOINT = "/api/trending-topics/saved"

// "checking" = loading the saved topics while nothing is on screen yet
export type TrendingSearchStatus = "idle" | "checking" | "loading" | "success" | "partial_success" | "error"

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
const statusFor = (result: TrendingResult): TrendingSearchStatus =>
  result.topics.length >= TRENDING_TOPIC_COUNT ? "success" : "partial_success"

/**
 * The topics everyone sees are saved on the server (src/data/trending-topics/latest.md):
 * each search replaces them and Reset removes them for everyone. This store shows them,
 * keeps a running search alive while visiting another tool, and mirrors the last topics to
 * localStorage so they appear instantly before the saved ones are checked again. Bump the
 * version when TrendingResult changes shape.
 */
const store = createToolStore<TrendingSearchState>("trending-topics:result", IDLE, {
  version: 1,
  toStored: (state) => (isFinished(state.status) ? { ...state, stages: [], error: null } : IDLE),
})
let controller: AbortController | null = null
// Every search, reset and load takes a new token; a slower, older one never overwrites a newer one
let latestAction = 0

/**
 * Shows the saved topics, the latest search anyone ran. Nothing changes while a search
 * from this browser is running.
 */
async function loadSaved() {
  if (store.getSnapshot().status === "loading") return
  const action = ++latestAction
  if (store.getSnapshot().status === "idle") store.update({ status: "checking" })
  try {
    const { data } = await requestApi<{ result: TrendingResult | null }>(SAVED_ENDPOINT)
    if (action !== latestAction) return
    if (data.result) store.update({ status: statusFor(data.result), result: data.result, stages: [], error: null })
    else store.reset()
  } catch (error: unknown) {
    if (action !== latestAction) return
    console.warn("Couldn't load the saved trending topics:", error)
    // Whatever this browser already shows stays; only the loading state ends
    if (store.getSnapshot().status === "checking") store.update({ status: "idle" })
  }
}

/**
 * Runs one fresh search at a time. Starting a search clears the previous results
 * immediately, so old topics never stay on screen under new ones. The server saves
 * the topics it finds for everyone.
 */
async function search() {
  controller?.abort()
  const current = new AbortController()
  controller = current
  latestAction++
  store.update({ status: "loading", result: null, stages: [], error: null })

  try {
    const response = await fetch(SEARCH_ENDPOINT, { method: "POST", signal: current.signal })
    if (!response.ok || !response.body) throw new Error(`Search request failed with status ${response.status}`)

    let hasResult = false
    await readSSEStream<TrendingStreamEvent>(response.body, (event) => {
      if (current.signal.aborted) return
      if (event.status === "COMPLETE") {
        hasResult = true
        store.update({ status: statusFor(event.result), result: event.result })
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

/**
 * Cancels a running search and removes the saved topics for everyone. If the server
 * can't remove them, they come back on screen with the reason.
 */
async function reset() {
  controller?.abort()
  controller = null
  const action = ++latestAction
  const previous = store.getSnapshot().result
  store.reset()
  try {
    await requestApi<{ result: null }>(SAVED_ENDPOINT, { method: "DELETE" })
  } catch (error: unknown) {
    if (action !== latestAction) return
    const message = error instanceof Error ? error.message : TRENDING_MESSAGES.clearFailed
    store.update(previous ? { status: statusFor(previous), result: previous, error: message } : { status: "error", error: message })
  }
}

export function useTrendingTopicsSearch() {
  const { status, result, stages, error } = useToolStore(store)
  return { status, result, stages, error, search, reset, loadSaved }
}
