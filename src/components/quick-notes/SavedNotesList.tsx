"use client"

import React, { useEffect, useRef } from "react"
import { AlertTriangle, Loader2, NotebookPen, RefreshCw, Trash2 } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { NOTE_PREVIEW_MAX_LENGTH, QUICK_NOTES_MESSAGES } from "@/constants/quickNotes"
import type { QuickNote } from "@/types/quickNotes"

interface SavedNotesListProps {
  notes: QuickNote[]
  total: number
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: string | null
  // Ids being deleted right now, so a note cannot be deleted twice
  deletingIds: string[]
  // Which notes are ticked for deleting several at once, and how a tick is made
  pickedIds: ReadonlySet<string>
  onPick: (id: string, isRange: boolean) => void
  onRetry: () => void
  onLoadMore: () => void
  onDelete: (note: QuickNote) => void
}

const savedAt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

/**
 * One saved note: the text, when it was saved, a copy action that always takes the whole note,
 * and a delete that removes it straight away. Notes are small and easy to save again, so deleting
 * one does not ask first.
 */
const NoteCard: React.FC<{
  note: QuickNote
  isDeleting: boolean
  isPicked: boolean
  onPick: (id: string, isRange: boolean) => void
  onDelete: (note: QuickNote) => void
}> = ({ note, isDeleting, isPicked, onPick, onDelete }) => {
  const isCut = note.content.length > NOTE_PREVIEW_MAX_LENGTH
  return (
    <li
      className={`rounded-xl border border-outline-variant bg-surface-container-lowest p-3 transition-opacity ${
        isDeleting ? "opacity-50" : ""
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isPicked}
            disabled={isDeleting}
            onChange={(event) => onPick(note.id, (event.nativeEvent as MouseEvent).shiftKey)}
            aria-label={`Pick the note saved ${savedAt(note.createdAt)}`}
            className="h-4 w-4 accent-primary"
          />
          <span className="text-[11px] text-outline">{savedAt(note.createdAt)}</span>
        </span>
        <div className="flex items-center gap-1">
          <CopyButton text={note.content} label="Copy this note" showLabel />
          <button
            type="button"
            onClick={() => onDelete(note)}
            disabled={isDeleting}
            aria-label="Delete this note"
            title="Delete this note"
            className="inline-flex items-center gap-1 rounded-md p-1 text-[11px] text-outline transition-colors hover:bg-error/5 hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 size={14} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-on-surface">
        {isCut ? `${note.content.slice(0, NOTE_PREVIEW_MAX_LENGTH)}…` : note.content}
      </p>
      {isCut && <p className="mt-1 text-[11px] text-outline">Shown in part. Copy takes the whole note.</p>}
    </li>
  )
}

/**
 * The saved notes, newest first. The next batch loads as the list is scrolled, so there are no
 * page buttons; the list only holds what has been scrolled to.
 */
export const SavedNotesList: React.FC<SavedNotesListProps> = ({
  notes,
  total,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  deletingIds,
  pickedIds,
  onPick,
  onRetry,
  onLoadMore,
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
      { rootMargin: "200px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, error, onLoadMore])

  return (
    <section
      aria-label="Saved notes"
      className="flex min-h-[240px] flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm lg:min-h-0"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-on-surface">Saved Notes</h2>
        {total > 0 && <span className="text-[11px] text-outline">{total.toLocaleString()} saved</span>}
      </div>

      {error && notes.length === 0 ? (
        <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-error-container text-error">
            <AlertTriangle size={20} aria-hidden="true" />
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-on-surface-variant">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : isLoading && notes.length === 0 ? (
        <div role="status" className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center">
          <Loader2 size={22} className="animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold text-on-surface">Loading your notes...</p>
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/5 text-primary">
            <NotebookPen size={20} aria-hidden="true" />
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-on-surface-variant">{QUICK_NOTES_MESSAGES.empty}</p>
        </div>
      ) : (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
          <ul className="space-y-2">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                isDeleting={deletingIds.includes(note.id)}
                isPicked={pickedIds.has(note.id)}
                onPick={onPick}
                onDelete={onDelete}
              />
            ))}
          </ul>

          {/* Scrolling this into view loads the next batch */}
          <div ref={sentinelRef} className="pt-3 text-center text-[11px] text-outline" aria-live="polite">
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
                Loading more notes...
              </span>
            ) : hasMore ? (
              <button type="button" onClick={onLoadMore} className="font-semibold text-primary underline hover:no-underline">
                Load more notes
              </button>
            ) : (
              <span>That is everything.</span>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
