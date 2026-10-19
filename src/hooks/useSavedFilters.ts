"use client"

import { useEffect, useRef, useState } from "react"
import { requestApi } from "@/lib/apiClient"
import { SAVED_FILTERS_ENDPOINT, SAVED_FILTERS_MESSAGES } from "@/constants/savedFilters"
import { cleanFilters, sameFilters, type SavedFilters } from "@/lib/savedFilters"

/**
 * Keeps one page's filters on the account, so a filter put on is still on after moving to another
 * tool, after a reload, and after signing out and in, on any machine (`constants/savedFilters.ts`).
 *
 * **It syncs what the page already holds rather than owning it.** Every one of these pages keeps its
 * filters its own way and runs its own request off them, so a hook that owned them would mean
 * rewriting thirteen pages and their effects. This takes the values the page is showing and the one
 * function that puts values back, which is all it needs to keep both ends in step, and the page's
 * own request, debouncing and paging are untouched. **The filtering itself still happens where it
 * always did, in the database**: these are only the values the page sends.
 *
 * Two rules keep it honest:
 *   - **the browser's own copy is only for the first paint.** The list is drawn before the account
 *     can answer, so what this browser last saw is applied at once and the account's answer replaces
 *     it when it lands. The account wins, which is what makes a filter set on another machine show
 *     up here;
 *   - **nothing the user has touched is ever overwritten.** The answer is only applied while the
 *     page still shows exactly what was applied from the browser's copy (or nothing at all), so a
 *     filter typed in the second before the answer arrives is never pulled out from under them.
 *
 * Saving waits for typing to settle, so a search box is one write rather than one per letter, and
 * writes go one at a time so two quick changes land in the order they were made. **Nothing is
 * written until the account has been asked**, so an empty page can never wipe what is stored, and a
 * filter put on while that answer is still on its way is saved the moment it lands rather than
 * waiting for the next change: that is why readiness is state here and not a ref. A write is also
 * skipped while the account already says exactly this, so opening a page costs no write at all.
 */

// Long enough that a search box is saved once, short enough to survive closing the tab straight after
const SAVE_AFTER_MS = 600

const keyFor = (view: string) => `linkpilot:filters:${view}`

const remember = (view: string, filters: SavedFilters) => {
  try {
    localStorage.setItem(keyFor(view), JSON.stringify(filters))
  } catch {
    // A browser with storage switched off simply waits for the account's answer
  }
}

const lastSeen = (view: string): SavedFilters | null => {
  try {
    const raw = localStorage.getItem(keyFor(view))
    return raw ? cleanFilters(view, JSON.parse(raw)) : null
  } catch {
    return null
  }
}

interface SavedFiltersOptions {
  // The page itself, e.g. "meetings" (constants/savedFilters.ts)
  view: string
  // What the page is filtered on right now, as plain strings ("" for a filter that is off)
  filters: SavedFilters
  // Puts kept filters back on the page; called at most twice, once per source. It is read through
  // a ref, so a page passes a plain function and never has to memoise one
  apply: (filters: SavedFilters) => void
  // Said on the page when a filter could not be kept, so nothing is remembered silently wrong
  onSaveFailed?: (message: string) => void
}

export function useSavedFilters({ view, filters, apply, onSaveFailed }: SavedFiltersOptions): void {
  // What was last put on the page by us, so the user's own typing is never overwritten
  const applied = useRef<SavedFilters | null>(null)
  // What is on the page now, and the page's own two functions, read inside the effects below
  // without making them run again. They are kept up to date in an effect of their own, because a
  // ref written while rendering is a ref another render may never see
  const showing = useRef(filters)
  const applyNow = useRef(apply)
  const failed = useRef(onSaveFailed)
  useEffect(() => {
    showing.current = filters
    applyNow.current = apply
    failed.current = onSaveFailed
  })
  // Nothing is saved until the kept filters have been read, or an empty page would wipe them. It is
  // state rather than a ref so that a filter put on while the answer was still coming is saved as
  // soon as it lands, instead of sitting unsaved until the next thing the user changes
  const [isReady, setReady] = useState(false)
  // What the account is known to be carrying, so opening a page writes nothing back
  const stored = useRef<SavedFilters | null>(null)
  const saving = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    let left = false
    const seen = lastSeen(view)
    if (seen) {
      applied.current = seen
      applyNow.current(seen)
    }

    const controller = new AbortController()
    requestApi<SavedFilters>(`${SAVED_FILTERS_ENDPOINT}/${view}`, { signal: controller.signal })
      .then(({ data }) => {
        if (left) return
        const kept = cleanFilters(view, data)
        stored.current = kept
        remember(view, kept)
        // Only what we put there ourselves may be replaced; anything typed since is the user's
        const untouched = applied.current === null || sameFilters(showing.current, applied.current)
        if (untouched && !sameFilters(showing.current, kept)) {
          applied.current = kept
          applyNow.current(kept)
        }
      })
      .catch(() => {
        // The account could not be asked, so the page keeps what this browser last saw
      })
      .finally(() => {
        if (!left) setReady(true)
      })

    return () => {
      left = true
      setReady(false)
      stored.current = null
      controller.abort()
    }
  }, [view])

  // Whatever the page is showing is what is kept, once typing has settled
  const asText = JSON.stringify(filters)
  useEffect(() => {
    if (!isReady) return
    const kept = cleanFilters(view, JSON.parse(asText) as SavedFilters)
    // The account already says this, which is the ordinary case on opening a page
    if (stored.current && sameFilters(kept, stored.current)) return
    const timer = setTimeout(() => {
      applied.current = kept
      stored.current = kept
      remember(view, kept)
      saving.current = saving.current
        .catch(() => undefined)
        .then(() =>
          requestApi<SavedFilters>(`${SAVED_FILTERS_ENDPOINT}/${view}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(kept),
          })
        )
        .catch((reason: unknown) => {
          failed.current?.(reason instanceof Error ? reason.message : SAVED_FILTERS_MESSAGES.saveFailed)
        })
    }, SAVE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [view, asText, isReady])
}
