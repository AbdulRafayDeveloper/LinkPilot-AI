"use client"

import { useSyncExternalStore } from "react"
import { requestApi } from "@/lib/apiClient"
import { appendDayRange } from "@/lib/dayRange"
import { todayIso } from "@/lib/taskDates"
import type { CommentCount } from "@/types/commentWriter"

/**
 * The reminder of how much commenting has been done: the comments written today and the whole total,
 * read once per page load from the comments Comment Writer already saves, and raised by one as each
 * new comment arrives, so the number follows the page without being read again.
 *
 * Nothing is kept in the browser, so a count from an earlier day or another account is never shown;
 * a day that turns over while the page is open is read again rather than counted on.
 */

const COUNT_ENDPOINT = "/api/comment-writer/count"

export type CommentCountState = { status: "loading" | "ready"; today: number; total: number }

const LOADING: CommentCountState = { status: "loading", today: 0, total: 0 }
let current: CommentCountState = LOADING
// The day the count was read for, which is the browser's own day, not the server's
let countedDay = ""
let request: Promise<void> | null = null
const listeners = new Set<() => void>()
const announce = () => listeners.forEach((listener) => listener())

function read() {
  countedDay = todayIso()
  request = requestApi<CommentCount>(`${COUNT_ENDPOINT}?${appendDayRange(new URLSearchParams(), countedDay, "")}`)
    .then(({ data }) => {
      current = { status: "ready", ...data }
    })
    .catch(() => {
      // The count is only a reminder, so a page that can't read it shows none rather than an error
    })
    .finally(() => {
      request = null
      announce()
    })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!request && current.status === "loading") read()
  return () => listeners.delete(listener)
}

/** One more comment was written: the reminder goes up by one, or is read again on a new day. */
export function countedOneComment() {
  if (current.status !== "ready" || countedDay !== todayIso()) {
    read()
    return
  }
  current = { status: "ready", today: current.today + 1, total: current.total + 1 }
  announce()
}

export function useCommentCount(): CommentCountState {
  return useSyncExternalStore(subscribe, () => current, () => LOADING)
}
