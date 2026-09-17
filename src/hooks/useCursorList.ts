"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { requestApi } from "@/lib/apiClient"
import { HISTORY_MESSAGES } from "@/constants/historyFilters"

/** One batch of a newest-first list, the shape every cursor-paged list route answers with. */
export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
  total: number
}

// The request this answer belongs to, so an answer to an older filter is never mistaken for the current one
type Answer<P> = P & { key: string }

interface UseCursorListOptions<T> {
  endpoint: string
  // The filters as a query string, without the cursor. A change starts the list again from the newest row
  query: string
  // False while the filters can't be sent (a backwards date range), so nothing is asked for
  enabled: boolean
  loadFailed: string
  idOf: (item: T) => string
}

/**
 * A filtered list loaded a batch at a time. A new filter replaces the request still on its way, so
 * a slow answer never overwrites a newer one, and the rows already on screen stay there (dimmed by
 * the page) until the new ones arrive. Later batches are appended without ever repeating a row.
 */
export function useCursorList<T, P extends CursorPage<T> = CursorPage<T>>({ endpoint, query, enabled, loadFailed, idOf }: UseCursorListOptions<T>) {
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${query}#${attempt}`
  const [answer, setAnswer] = useState<Answer<P> | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)
  const [moreError, setMoreError] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const isFetchingMore = useRef(false)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    requestApi<P>(`${endpoint}?${query}`, { signal: controller.signal })
      .then(({ data }) => {
        setAnswer({ key: requestKey, ...data })
        setFailure(null)
        setMoreError(null)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setFailure({ key: requestKey, message: reason instanceof Error ? reason.message : loadFailed })
      })
    return () => controller.abort()
  }, [endpoint, query, requestKey, enabled, loadFailed])

  const loadMore = useCallback(async () => {
    if (!answer?.nextCursor || answer.key !== requestKey || isFetchingMore.current) return
    isFetchingMore.current = true
    setIsLoadingMore(true)
    const { key, nextCursor } = answer
    try {
      const { data } = await requestApi<CursorPage<T>>(`${endpoint}?${query}${query ? "&" : ""}cursor=${encodeURIComponent(nextCursor)}`)
      setAnswer((current) => {
        // The filters changed while this batch was on its way, so it belongs to a list no longer shown
        if (!current || current.key !== key) return current
        const seen = new Set(current.items.map(idOf))
        // Everything else the first answer carried (such as filter options) stays as it was
        return { ...current, items: [...current.items, ...data.items.filter((item) => !seen.has(idOf(item)))], nextCursor: data.nextCursor, total: data.total }
      })
      setMoreError(null)
    } catch (reason: unknown) {
      setMoreError(reason instanceof Error ? reason.message : HISTORY_MESSAGES.moreFailed)
    } finally {
      isFetchingMore.current = false
      setIsLoadingMore(false)
    }
  }, [answer, requestKey, endpoint, query, idOf])

  /** Changes the rows on screen after an edit or a delete, without asking the server again. */
  const update = useCallback((change: (items: T[]) => T[], totalChange = 0) => {
    setAnswer((current) => current && { ...current, items: change(current.items), total: Math.max(0, current.total + totalChange) })
  }, [])

  const hasCurrentAnswer = answer?.key === requestKey
  const hasCurrentFailure = failure?.key === requestKey

  return {
    items: answer?.items ?? [],
    total: answer?.total ?? 0,
    hasAnswer: answer !== null,
    // The latest full answer, for anything a page's route sends beyond the rows
    latest: answer,
    hasMore: hasCurrentAnswer && Boolean(answer?.nextCursor),
    isLoading: enabled && !hasCurrentAnswer && !hasCurrentFailure,
    isLoadingMore,
    error: hasCurrentFailure ? (failure?.message ?? loadFailed) : null,
    moreError,
    loadMore,
    retry: () => setAttempt((count) => count + 1),
    update,
  }
}
