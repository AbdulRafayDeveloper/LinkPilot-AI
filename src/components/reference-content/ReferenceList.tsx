"use client"

import React, { useEffect, useRef, useState } from "react"
import { AlertTriangle, BookMarked, ChevronDown, ChevronUp, Loader2, Pencil, RefreshCw, SearchX, Trash2 } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { REFERENCE_CONTENT_MESSAGES, REFERENCE_PREVIEW_MAX_LENGTH } from "@/constants/referenceContent"
import type { ReferenceItem } from "@/types/referenceContent"

interface ReferenceListProps {
  items: ReferenceItem[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: string | null
  // True while a search is in effect, so "nothing found" reads differently from "nothing saved"
  isSearching: boolean
  deletingId: string | null
  onRetry: () => void
  onLoadMore: () => void
  onEdit: (item: ReferenceItem) => void
  onDelete: (item: ReferenceItem) => void
}

const savedAt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })

const actionButton =
  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"

/**
 * One saved item: its name, the text (cut until it is opened), and the three things to do with
 * it. Copy always takes the whole text, however much of it the card is showing.
 */
const ReferenceCard: React.FC<{
  item: ReferenceItem
  isDeleting: boolean
  onEdit: (item: ReferenceItem) => void
  onDelete: (item: ReferenceItem) => void
}> = ({ item, isDeleting, onEdit, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false)
  const isCut = item.content.length > REFERENCE_PREVIEW_MAX_LENGTH
  const shown = isCut && !isOpen ? `${item.content.slice(0, REFERENCE_PREVIEW_MAX_LENGTH)}…` : item.content

  return (
    <li
      className={`flex flex-col gap-2 rounded-2xl border border-outline-variant bg-white p-4 shadow-sm transition-opacity ${
        isDeleting ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 break-words text-sm font-bold text-on-surface">{item.title}</h3>
        <span className="shrink-0 text-[11px] text-outline">{savedAt(item.updatedAt)}</span>
      </div>

      <p
        className={`whitespace-pre-wrap break-words text-[13px] leading-relaxed text-on-surface-variant ${
          isOpen ? "custom-scrollbar max-h-[320px] overflow-y-auto pr-1" : ""
        }`}
      >
        {shown}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/70 pt-2">
        {isCut ? (
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            className={`${actionButton} text-outline hover:bg-surface-container hover:text-primary`}
          >
            {isOpen ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
            {isOpen ? "Show less" : "Show all"}
          </button>
        ) : (
          <span className="text-[11px] text-outline">{item.content.length.toLocaleString()} characters</span>
        )}

        <div className="flex items-center gap-1">
          <CopyButton text={item.content} label={`Copy ${item.title}`} showLabel />
          <button
            type="button"
            onClick={() => onEdit(item)}
            disabled={isDeleting}
            aria-label={`Edit ${item.title}`}
            className={`${actionButton} text-outline hover:bg-surface-container hover:text-primary disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Pencil size={13} aria-hidden="true" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            disabled={isDeleting}
            aria-label={`Delete ${item.title}`}
            className={`${actionButton} text-outline hover:bg-error/5 hover:text-error disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isDeleting ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Trash2 size={13} aria-hidden="true" />}
            Delete
          </button>
        </div>
      </div>
    </li>
  )
}

const CenteredState: React.FC<{ icon: React.ReactNode; text: string; children?: React.ReactNode; role?: "alert" | "status" }> = ({
  icon,
  text,
  children,
  role,
}) => (
  <div role={role} className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
    {icon}
    <p className="max-w-sm text-sm leading-relaxed text-on-surface-variant">{text}</p>
    {children}
  </div>
)

/**
 * The saved content as cards, newest first. The next batch loads as the list is scrolled, so the
 * page never holds more than what has been scrolled to.
 */
export const ReferenceList: React.FC<ReferenceListProps> = ({
  items,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  isSearching,
  deletingId,
  onRetry,
  onLoadMore,
  onEdit,
  onDelete,
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null)

  // The batch after this one loads when the end of the list comes into view
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore || isLoadingMore || error) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore()
      },
      // Starts the next batch a little before the end of the list is reached
      { rootMargin: "300px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, error, onLoadMore])

  if (error && items.length === 0) {
    return (
      <CenteredState
        role="alert"
        icon={
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-error-container text-error">
            <AlertTriangle size={20} aria-hidden="true" />
          </div>
        }
        text={error}
      >
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
        >
          <RefreshCw size={15} aria-hidden="true" />
          Try again
        </button>
      </CenteredState>
    )
  }

  if (isLoading && items.length === 0) {
    return (
      <CenteredState
        role="status"
        icon={<Loader2 size={22} className="animate-spin text-primary" aria-hidden="true" />}
        text="Loading your saved content..."
      />
    )
  }

  if (items.length === 0) {
    return (
      <CenteredState
        icon={
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/5 text-primary">
            {isSearching ? <SearchX size={20} aria-hidden="true" /> : <BookMarked size={20} aria-hidden="true" />}
          </div>
        }
        text={isSearching ? REFERENCE_CONTENT_MESSAGES.noResults : REFERENCE_CONTENT_MESSAGES.empty}
      />
    )
  }

  return (
    <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <ReferenceCard key={item.id} item={item} isDeleting={deletingId === item.id} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </ul>

      {/* Scrolling this into view loads the next batch */}
      <div ref={sentinelRef} className="pt-4 text-center text-[11px] text-outline" aria-live="polite">
        {error ? (
          <span role="alert" className="flex items-center justify-center gap-2 text-error">
            {error}
            <button type="button" onClick={onRetry} className="font-semibold underline hover:no-underline">
              Try again
            </button>
          </span>
        ) : isLoadingMore ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            Loading more...
          </span>
        ) : hasMore ? (
          <button type="button" onClick={onLoadMore} className="font-semibold text-primary underline hover:no-underline">
            Load more
          </button>
        ) : (
          <span>That is everything.</span>
        )}
      </div>
    </div>
  )
}
