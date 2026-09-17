"use client"

import React, { useEffect, useRef } from "react"
import { Loader2, RefreshCw } from "lucide-react"

interface LoadMoreProps {
  hasMore: boolean
  isLoadingMore: boolean
  error: string | null
  onLoadMore: () => void
  // What the end of the list says once everything is on screen
  doneText: string
}

/**
 * The end of a lazily loaded list. The next batch loads when this comes into view, and the button
 * does the same for the keyboard, for a browser without IntersectionObserver and after a failure,
 * which never retries on its own.
 */
export const LoadMore: React.FC<LoadMoreProps> = ({ hasMore, isLoadingMore, error, onLoadMore, doneText }) => {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore || isLoadingMore || error || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onLoadMore()
    }, { rootMargin: "400px" })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, error, onLoadMore])

  return (
    <div ref={sentinelRef} className="flex flex-col items-center gap-2 py-3 text-center text-[12px] text-outline" aria-live="polite">
      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
      {isLoadingMore ? (
        <span className="flex items-center gap-2">
          <Loader2 size={13} className="animate-spin text-primary" aria-hidden="true" />
          Loading more...
        </span>
      ) : hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {error && <RefreshCw size={13} aria-hidden="true" />}
          Load more
        </button>
      ) : (
        <span>{doneText}</span>
      )}
    </div>
  )
}
