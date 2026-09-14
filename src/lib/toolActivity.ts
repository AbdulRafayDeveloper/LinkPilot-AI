"use client"

import { useSyncExternalStore } from "react"

/**
 * What each tool is doing in the background, for the sidebar and header: a generation still
 * running, or one that finished (or failed) while the user was on another page. Result stores
 * report their status here (the `activity` option of createToolStore); opening a tool marks
 * its finished result as seen. Kept in memory only, since a refresh cancels running requests.
 */
export type ActivityState = "running" | "ready" | "failed"

export interface ToolActivity {
  href: string
  state: ActivityState
}

const FINISHED = new Set(["success", "partial_success"])

const states = new Map<string, ActivityState>()
const listeners = new Set<() => void>()
const EMPTY: ToolActivity[] = []
let snapshot: ToolActivity[] = EMPTY

function publish() {
  snapshot = states.size === 0 ? EMPTY : [...states].map(([href, state]) => ({ href, state }))
  listeners.forEach((listener) => listener())
}

const isOpen = (href: string) => typeof window !== "undefined" && window.location.pathname === href

/**
 * Called by a result store on every change. "loading" means running; a run that ends while
 * its tool isn't open becomes "ready" or "failed" until the tool is opened; a reset clears it.
 */
export function reportToolStatus(href: string, status: string) {
  const previous = states.get(href)
  let next: ActivityState | undefined = previous
  if (status === "loading") next = "running"
  else if (previous === "running") next = isOpen(href) ? undefined : FINISHED.has(status) ? "ready" : status === "error" ? "failed" : undefined
  else if (status === "idle") next = undefined
  if (next === previous) return
  if (next) states.set(href, next)
  else states.delete(href)
  publish()
}

// The user opened this tool, so its finished result has been seen
export function markToolSeen(href: string) {
  const state = states.get(href)
  if (state === "ready" || state === "failed") {
    states.delete(href)
    publish()
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useToolActivity(): ToolActivity[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY)
}
