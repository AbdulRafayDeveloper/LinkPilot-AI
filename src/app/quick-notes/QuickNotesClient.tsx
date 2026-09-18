"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { NotebookPen, Save, Trash2 } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { SavedNotesList } from "@/components/quick-notes/SavedNotesList"
import { BulkDeleteBar, ConfirmBulkDelete } from "@/components/ui/BulkDelete"
import { useRowSelection } from "@/hooks/useRowSelection"
import { ClearNotesDialog } from "@/components/quick-notes/ClearNotesDialog"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { createToolStore, useToolStore } from "@/lib/toolStore"
import { requestApi } from "@/lib/apiClient"
import { NOTE_MAX_LENGTH, QUICK_NOTES_ENDPOINT, QUICK_NOTES_MESSAGES } from "@/constants/quickNotes"
import type { QuickNote, QuickNotesFeed } from "@/types/quickNotes"

// What is being typed survives switching tools, like every other tool's input
const draftStore = createToolStore("quick-notes:draft", { content: "" }, { version: 1 })

type SaveState = { type: "idle" } | { type: "saving" } | { type: "saved"; message: string } | { type: "error"; message: string }

// What the list holds right now: the batches scrolled through so far
interface Feed {
  notes: QuickNote[]
  nextCursor: string | null
  total: number
}

const EMPTY_FEED: Feed = { notes: [], nextCursor: null, total: 0 }

export default function QuickNotesClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [feed, setFeed] = useState<Feed>(EMPTY_FEED)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [reloadAttempt, setReloadAttempt] = useState(0)
  const [saveState, setSaveState] = useState<SaveState>({ type: "idle" })
  const [deletingIds, setDeletingIds] = useState<string[]>([])
  const [isConfirmingClear, setIsConfirmingClear] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  // Deleting the ticked notes, which is confirmed the same way Clear All is
  const [isConfirmingPicked, setIsConfirmingPicked] = useState(false)
  const [isDeletingPicked, setIsDeletingPicked] = useState(false)
  const { content } = useToolStore(draftStore)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  // Only the newest batch is fetched here; scrolling asks for the ones after it
  const isFetchingRef = useRef(false)

  // The newest batch is loaded on arrival, and again after saving, deleting or clearing
  useEffect(() => {
    const controller = new AbortController()
    requestApi<QuickNotesFeed>(QUICK_NOTES_ENDPOINT, { signal: controller.signal })
      .then(({ data }) => {
        setFeed({ notes: data.notes, nextCursor: data.nextCursor, total: data.total })
        setListError(null)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setListError(error instanceof Error ? error.message : QUICK_NOTES_MESSAGES.loadFailed)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [reloadAttempt])

  // Starts again from the newest note
  const reload = useCallback(() => {
    setIsLoading(true)
    setListError(null)
    setReloadAttempt((attempt) => attempt + 1)
  }, [])

  // The batch after the last one, appended to what is already on screen
  const loadMore = useCallback(async () => {
    if (isFetchingRef.current) return
    const cursor = feed.nextCursor
    if (!cursor) return
    isFetchingRef.current = true
    setIsLoadingMore(true)
    setListError(null)
    try {
      const { data } = await requestApi<QuickNotesFeed>(`${QUICK_NOTES_ENDPOINT}?cursor=${encodeURIComponent(cursor)}`)
      setFeed((current) => {
        // A note already on screen is never added twice, whatever happened meanwhile
        const seen = new Set(current.notes.map((note) => note.id))
        return {
          notes: [...current.notes, ...data.notes.filter((note) => !seen.has(note.id))],
          nextCursor: data.nextCursor,
          total: data.total,
        }
      })
    } catch (error: unknown) {
      setListError(error instanceof Error ? error.message : QUICK_NOTES_MESSAGES.moreFailed)
    } finally {
      isFetchingRef.current = false
      setIsLoadingMore(false)
    }
  }, [feed.nextCursor])

  const save = async () => {
    if (saveState.type === "saving") return
    if (!content.trim()) {
      setSaveState({ type: "error", message: QUICK_NOTES_MESSAGES.missingContent })
      inputRef.current?.focus()
      return
    }
    setSaveState({ type: "saving" })
    try {
      const { message } = await requestApi<QuickNote>(QUICK_NOTES_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }, { idempotent: true })
      draftStore.update({ content: "" })
      setSaveState({ type: "saved", message: message || QUICK_NOTES_MESSAGES.saved })
      // The list starts again from the newest note, so the one just saved is at the top
      reload()
      inputRef.current?.focus()
    } catch (error: unknown) {
      setSaveState({ type: "error", message: error instanceof Error ? error.message : QUICK_NOTES_MESSAGES.saveFailed })
    }
  }

  /**
   * Deletes one note at once, with no confirmation: notes are small and easy to save again. The
   * note leaves the list straight away and comes back if the server could not delete it.
   */
  const deleteNote = async (note: QuickNote) => {
    if (deletingIds.includes(note.id)) return
    setDeletingIds((current) => [...current, note.id])
    setSaveState({ type: "idle" })
    try {
      await requestApi<{ deleted: number }>(`${QUICK_NOTES_ENDPOINT}/${note.id}`, { method: "DELETE" })
      setFeed((current) => ({
        ...current,
        notes: current.notes.filter((entry) => entry.id !== note.id),
        total: Math.max(0, current.total - 1),
      }))
    } catch (error: unknown) {
      setSaveState({ type: "error", message: error instanceof Error ? error.message : QUICK_NOTES_MESSAGES.deleteFailed })
    } finally {
      setDeletingIds((current) => current.filter((id) => id !== note.id))
    }
  }

  const selection = useRowSelection(feed.notes.map((note) => note.id))

  /** Deletes the ticked notes in one call, behind the same kind of confirmation as Clear All. */
  const deletePicked = async () => {
    if (isDeletingPicked) return
    setIsDeletingPicked(true)
    setClearError(null)
    try {
      await requestApi<{ deleted: number }>(QUICK_NOTES_ENDPOINT, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selection.pickedIds] }),
      })
      selection.clear()
      setIsConfirmingPicked(false)
      setReloadAttempt((attempt) => attempt + 1)
    } catch (reason: unknown) {
      setClearError(reason instanceof Error ? reason.message : QUICK_NOTES_MESSAGES.clearFailed)
      setIsConfirmingPicked(false)
    } finally {
      setIsDeletingPicked(false)
    }
  }

  const clearAll = async () => {
    if (isClearing) return
    setIsClearing(true)
    setClearError(null)
    try {
      await requestApi<{ deleted: number }>(QUICK_NOTES_ENDPOINT, { method: "DELETE" })
      setIsConfirmingClear(false)
      setSaveState({ type: "saved", message: QUICK_NOTES_MESSAGES.cleared })
      reload()
    } catch (error: unknown) {
      setClearError(error instanceof Error ? error.message : QUICK_NOTES_MESSAGES.clearFailed)
    } finally {
      setIsClearing(false)
    }
  }

  const isSaving = saveState.type === "saving"
  const hasNotes = feed.total > 0
  const isOverLimit = content.length > NOTE_MAX_LENGTH

  return (
    <div className="font-body-md text-body-md min-h-screen bg-background text-on-surface flex overflow-hidden h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        <Header
          onOpenSidebar={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapsed}
        />

        <main className="flex-1 overflow-y-auto bg-background overflow-x-hidden">
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-5 lg:h-full">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                  <NotebookPen size={24} className="text-primary shrink-0" aria-hidden="true" />
                  Temporary Quick Notes
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Keep anything you copy or write, and pick it up again whenever you need it.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setClearError(null)
                    setIsConfirmingClear(true)
                  }}
                  disabled={!hasNotes || isClearing}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap gap-2 px-4 py-2.5 border border-error/40 text-error rounded-xl text-sm font-semibold transition-colors hover:bg-error/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Clear All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 lg:flex-1 lg:min-h-0">
              <BulkDeleteBar
                pickedCount={selection.pickedIds.size}
                total={null}
                noun={{ one: "note", many: "notes" }}
                isBusy={isDeletingPicked}
                onDeletePicked={() => setIsConfirmingPicked(true)}
                onClear={selection.clear}
              />

              <SavedNotesList
                notes={feed.notes}
                total={feed.total}
                isLoading={isLoading}
                isLoadingMore={isLoadingMore}
                hasMore={feed.nextCursor !== null}
                error={listError}
                deletingIds={deletingIds}
                pickedIds={selection.pickedIds}
                onPick={selection.pick}
                onRetry={reload}
                onLoadMore={loadMore}
                onDelete={deleteNote}
              />

              {/* Save something new */}
              <section
                aria-label="Save content"
                className="flex min-h-0 flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm"
              >
                <h2 className="text-sm font-bold text-on-surface">Save Content</h2>
                <label htmlFor="quick-note-content" className="text-[10px] font-bold uppercase tracking-wider text-outline">
                  Paste or write anything
                </label>
                <textarea
                  id="quick-note-content"
                  ref={inputRef}
                  value={content}
                  onChange={(event) => {
                    draftStore.update({ content: event.target.value })
                    if (saveState.type !== "saving") setSaveState({ type: "idle" })
                  }}
                  onKeyDown={(event) => {
                    // Ctrl/⌘+Enter saves, the way a send field does
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                      event.preventDefault()
                      void save()
                    }
                  }}
                  maxLength={NOTE_MAX_LENGTH}
                  disabled={isSaving}
                  aria-invalid={saveState.type === "error"}
                  aria-describedby="quick-note-status"
                  placeholder="Paste a message, a link, a snippet you want to reuse, or write a note to yourself."
                  className={`w-full flex-1 min-h-[220px] resize-none rounded-xl border bg-surface-container-lowest px-4 py-3 text-sm leading-relaxed text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 ${
                    saveState.type === "error" ? "border-error" : "border-outline-variant focus:border-primary/50"
                  }`}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-outline">
                  <span className={isOverLimit ? "font-semibold text-error" : ""}>
                    {content.length.toLocaleString()} / {NOTE_MAX_LENGTH.toLocaleString()} characters
                  </span>
                  <span>Ctrl + Enter saves</span>
                </div>

                <div id="quick-note-status" className="min-h-[20px] text-[12px]" aria-live="polite">
                  {saveState.type === "error" && (
                    <p role="alert" className="flex flex-wrap items-center gap-2 text-error">
                      {saveState.message}
                      <button type="button" onClick={save} className="font-semibold underline hover:no-underline">
                        Try again
                      </button>
                    </p>
                  )}
                  {saveState.type === "saved" && <p className="text-primary">{saveState.message}</p>}
                </div>

                <button
                  type="button"
                  onClick={save}
                  disabled={isSaving || isOverLimit}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={16} aria-hidden="true" />
                  {isSaving ? "Saving..." : "Save Note"}
                </button>
              </section>
            </div>
          </div>
        </main>
      </div>

      {isConfirmingPicked && (
        <ConfirmBulkDelete
          count={selection.pickedIds.size}
          noun={{ one: "note", many: "notes" }}
          isDeleting={isDeletingPicked}
          onConfirm={() => void deletePicked()}
          onClose={() => setIsConfirmingPicked(false)}
        />
      )}
      {isConfirmingClear && (
        <ClearNotesDialog
          total={feed.total}
          isClearing={isClearing}
          error={clearError}
          onConfirm={clearAll}
          onClose={() => {
            if (isClearing) return
            setIsConfirmingClear(false)
            setClearError(null)
          }}
        />
      )}
    </div>
  )
}
