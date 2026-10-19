"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { requestApi } from "@/lib/apiClient"
import { DAILY_TASKS_ENDPOINT, DAILY_TASKS_MESSAGES } from "@/constants/dailyTasks"
import { NOTHING_NARROWED, type TaskNarrowing } from "@/lib/taskFilters"

/**
 * What the list is narrowed to, **kept on the account** rather than in the page: it is still on
 * after moving to another tool and back, after a reload, and after signing out and in, on any
 * browser, until it is changed. That is the owner's own rule: a filter they put on stays on until
 * they take it off.
 *
 * The browser keeps a copy of its own (`localStorage`) for one reason only: the list is drawn
 * before the account can answer, and without it every task would flash past before the filter
 * arrived. **The account's answer wins** the moment it lands, exactly as the Client Voices choice
 * does, so a filter changed on another machine is what this one shows.
 *
 * Every change is saved at once and **one at a time** (`saving`), so two quick changes land in the
 * order they were made rather than racing. A save that fails leaves the filter on the page and says
 * so, rather than silently showing one thing and keeping another.
 */

const ENDPOINT = `${DAILY_TASKS_ENDPOINT}/filters`
// The page's own copy, so the first paint is already narrowed; the account's answer replaces it
const KEY = "linkpilot:daily-tasks:filters"

const remember = (filters: TaskNarrowing) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(filters))
  } catch {
    // A browser with storage switched off simply waits for the account's answer
  }
}

/** The browser's own copy, if it holds one that still reads like a narrowing. */
function lastSeen(): TaskNarrowing {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return NOTHING_NARROWED
    const saved = JSON.parse(raw) as Partial<TaskNarrowing>
    return { ...NOTHING_NARROWED, ...saved }
  } catch {
    return NOTHING_NARROWED
  }
}

export function useTaskFilters(): {
  narrowing: TaskNarrowing
  setNarrowing: (next: TaskNarrowing) => void
  error: string | null
} {
  const [narrowing, setFilters] = useState<TaskNarrowing>(NOTHING_NARROWED)
  const [error, setError] = useState<string | null>(null)
  // What is being written now, so two quick changes are saved one after the other
  const saving = useRef<Promise<unknown>>(Promise.resolve())
  // Once the user has changed something, a late answer from the account must not undo it
  const changed = useRef(false)

  useEffect(() => {
    // The page's own copy first, so the list is narrowed on the very first paint
    const seen = lastSeen()
    if (!changed.current) setFilters(seen)

    const controller = new AbortController()
    requestApi<TaskNarrowing>(ENDPOINT, { signal: controller.signal })
      .then(({ data }) => {
        if (changed.current) return
        setFilters(data)
        remember(data)
      })
      .catch(() => {
        // The account could not be asked, so the page keeps what this browser last saw
      })
    return () => controller.abort()
  }, [])

  const setNarrowing = useCallback((next: TaskNarrowing) => {
    changed.current = true
    setFilters(next)
    remember(next)
    setError(null)
    saving.current = saving.current
      .catch(() => undefined)
      .then(() =>
        requestApi<TaskNarrowing>(ENDPOINT, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        })
      )
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : DAILY_TASKS_MESSAGES.filtersSaveFailed)
      })
  }, [])

  return { narrowing, setNarrowing, error }
}
