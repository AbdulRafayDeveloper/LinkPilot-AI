"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, AudioLines, HelpCircle, ListChecks, Loader2, Mic, RefreshCw, SquarePlus, Trash2, Users } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { Pagination } from "@/components/ui/Pagination"
import { BulkDeleteBar, ConfirmBulkDelete } from "@/components/ui/BulkDelete"
import { DateRangeFilters, FilterPanel, SearchFilter, SelectFilter, historyLabelClass } from "@/components/history/HistoryFilters"
import { useRowSelection } from "@/hooks/useRowSelection"
import { useSavedFilters } from "@/hooks/useSavedFilters"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { filtersOf, savedDay, savedText, type SavedFilters } from "@/lib/savedFilters"
import { appendDayRange, isBackwardsRange } from "@/lib/dayRange"
import { requestApi } from "@/lib/apiClient"
import { HISTORY_DEBOUNCE_MS, HISTORY_MESSAGES } from "@/constants/historyFilters"
import { CLIENT_VOICES_MESSAGES, NO_CLIENT_FILTER, VOICE_BATCHES_ENDPOINT, clientVoicesBatchHref } from "@/constants/clientVoices"
import type { VoiceBatch, VoiceBatchesPage } from "@/types/clientVoices"
import { formatInstant } from "@/lib/timeZone"

const NOUN = { one: "batch", many: "batches" }

const runOn = (iso: string) =>
  formatInstant(iso, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

/**
 * What a batch is called, which is what the list is read by: the user's own title, or the one
 * written from the voices. A batch kept before titles existed falls back to its client's name, so
 * no row is ever nameless.
 */
const titleOf = (batch: VoiceBatch) => batch.title || batch.clientName || CLIENT_VOICES_MESSAGES.untitled

const pagerButton =
  "inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"

/** Whose batch it was, or that it was kept under no client, which is just as ordinary. */
const ClientTag: React.FC<{ batch: VoiceBatch }> = ({ batch }) =>
  batch.clientName ? (
    <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-primary-fixed/70 px-2 py-0.5 text-[11px] font-semibold text-on-primary-fixed-variant">
      <Users size={11} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{batch.clientName}</span>
    </span>
  ) : (
    <span className="text-[11px] text-outline">No client</span>
  )

/** How much came out of the batch: the voices that went in, and the two lists they produced. */
const Counts: React.FC<{ batch: VoiceBatch }> = ({ batch }) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-on-surface-variant">
    <span className="inline-flex items-center gap-1">
      <Mic size={11} className="text-outline" aria-hidden="true" />
      {batch.voiceCount} {batch.voiceCount === 1 ? "voice" : "voices"}
    </span>
    <span className="inline-flex items-center gap-1">
      <ListChecks size={11} className="text-outline" aria-hidden="true" />
      {batch.tasks.length} {batch.tasks.length === 1 ? "task" : "tasks"}
    </span>
    <span className="inline-flex items-center gap-1">
      <HelpCircle size={11} className="text-outline" aria-hidden="true" />
      {batch.questions.length} {batch.questions.length === 1 ? "question" : "questions"}
    </span>
    {batch.missingVoices.length > 0 && (
      <span className="text-on-secondary-fixed-variant">{batch.missingVoices.length} not written out</span>
    )}
  </div>
)

/**
 * Every batch of client voice messages ever run, newest first, 50 to a page: when it was run, whose
 * it was, how much came out of it, and the first thing the client asked for. A row opens that batch
 * on its own page, where its recordings play and its transcripts, tasks and questions are in full.
 *
 * The search, the client and the date range run in the database, so a filter covers every batch
 * rather than the page on screen, and they are kept on the account (hooks/useSavedFilters).
 */
export default function BatchHistoryClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const [search, setSearch] = useState("")
  const [client, setClient] = useState("")
  const [fromDay, setFromDay] = useState("")
  const [toDay, setToDay] = useState("")
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<VoiceBatchesPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [answered, setAnswered] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [confirmingMany, setConfirmingMany] = useState<"picked" | "all" | null>(null)
  const [isDeletingMany, setIsDeletingMany] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // The one batch waiting to be confirmed, and whether it is on its way out
  const [deletingOne, setDeletingOne] = useState<VoiceBatch | null>(null)
  const [isDeletingOne, setIsDeletingOne] = useState(false)

  const settledSearch = useDebouncedValue(search.trim(), HISTORY_DEBOUNCE_MS)
  const backwards = isBackwardsRange(fromDay, toDay)
  const params = new URLSearchParams({ page: String(page) })
  if (search.trim() && settledSearch) params.set("search", settledSearch)
  if (client) params.set("client", client)
  // The page sends the start and end of those days where the viewer is, so a day means their day
  if (!backwards) appendDayRange(params, fromDay, toDay)
  const query = params.toString()
  const requestKey = `${query}#${attempt}`
  const isLoading = !backwards && answered !== requestKey

  useEffect(() => {
    if (backwards) return
    // A newer request replaces the one on its way, so a slow answer never overwrites a newer one
    const controller = new AbortController()
    requestApi<VoiceBatchesPage>(`${VOICE_BATCHES_ENDPOINT}?${query}`, { signal: controller.signal })
      .then(({ data }) => {
        setResult(data)
        setError(null)
        // The server clamps a page past the end, and the pager follows it
        if (data.page !== page) setPage(data.page)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : CLIENT_VOICES_MESSAGES.historyFailed)
      })
      .finally(() => {
        if (!controller.signal.aborted) setAnswered(requestKey)
      })
    return () => controller.abort()
  }, [query, requestKey, page, backwards])

  const reload = () => setAttempt((count) => count + 1)
  const hasFilters = Boolean(search || client || fromDay || toDay)
  const clearFilters = () => {
    setSearch("")
    setClient("")
    setFromDay("")
    setToDay("")
    setPage(1)
  }

  // Kept on the account, so the list opens the way it was left, on any machine
  useSavedFilters({
    view: "client-voices-history",
    filters: filtersOf({ search, client, from: fromDay, to: toDay }),
    apply: (saved: SavedFilters) => {
      setSearch(savedText(saved.search))
      // A client is only what the records say, so it is kept as it is and simply matches nothing once gone
      setClient(savedText(saved.client))
      setFromDay(savedDay(saved.from))
      setToDay(savedDay(saved.to))
      setPage(1)
    },
  })

  const items = result?.items ?? []
  const total = result?.total ?? 0
  const pageSize = result?.pageSize ?? 0
  const totalPages = result?.totalPages ?? 1
  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1
  const lastShown = Math.min(total, (page - 1) * pageSize + items.length)
  const selection = useRowSelection(items.map((batch) => batch.id))
  const clientOptions = [
    { id: NO_CLIENT_FILTER, label: "No client" },
    ...(result?.clients ?? []).map((entry) => ({ id: entry.id, label: entry.name })),
  ]

  /** Deletes the ticked batches, or every batch the filters cover, with their recordings. */
  const deleteMany = async (which: "picked" | "all") => {
    if (isDeletingMany) return
    setIsDeletingMany(true)
    setDeleteError(null)
    try {
      const { data } = await requestApi<{ deleted: number; failed: number }>(`${VOICE_BATCHES_ENDPOINT}?${query}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(which === "picked" ? { ids: [...selection.pickedIds] } : { all: true }),
      })
      selection.clear()
      setConfirmingMany(null)
      setPage(1)
      reload()
      // A recording that could not be removed keeps its batch, so the user is told rather than left wondering
      if (data.failed > 0) setDeleteError(CLIENT_VOICES_MESSAGES.deleteBatchFailed)
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : CLIENT_VOICES_MESSAGES.deleteBatchFailed)
      setConfirmingMany(null)
    } finally {
      setIsDeletingMany(false)
    }
  }

  /**
   * One batch, with its recordings and transcripts. It is confirmed first, like every delete in the
   * app that takes more than a line of text with it.
   */
  const deleteOne = async (batch: VoiceBatch) => {
    if (isDeletingOne) return
    setIsDeletingOne(true)
    setDeleteError(null)
    try {
      await requestApi<{ deleted: number; failed: number }>(`${VOICE_BATCHES_ENDPOINT}/${batch.id}`, { method: "DELETE" })
      setDeletingOne(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : CLIENT_VOICES_MESSAGES.deleteBatchFailed)
      setDeletingOne(null)
    } finally {
      setIsDeletingOne(false)
    }
  }

  const actions = (batch: VoiceBatch) => (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Link
        href={clientVoicesBatchHref(batch.id)}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <AudioLines size={13} aria-hidden="true" />
        Open
      </Link>
      <button
        type="button"
        onClick={() => {
          setDeleteError(null)
          setDeletingOne(batch)
        }}
        aria-label={`Delete ${titleOf(batch)}`}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold text-outline transition-colors hover:bg-surface-container hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Trash2 size={13} aria-hidden="true" />
        Delete
      </button>
    </div>
  )

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 md:p-6 lg:p-8">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                  <AudioLines size={24} className="shrink-0 text-primary" aria-hidden="true" />
                  Saved Voice Batches
                </h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Every batch of client voice messages you have run, with its recordings, transcripts, tasks and questions.
                </p>
              </div>
              <Link
                href="/client-voices"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover sm:shrink-0"
              >
                <SquarePlus size={16} aria-hidden="true" />
                New Batch
              </Link>
            </div>

            <FilterPanel
              columnsClassName="lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"
              canClear={hasFilters}
              onClear={clearFilters}
              summary={
                backwards
                  ? HISTORY_MESSAGES.badDateRange
                  : result
                    ? `Showing ${firstShown.toLocaleString()} to ${lastShown.toLocaleString()} of ${total.toLocaleString()}`
                    : "Loading your batches..."
              }
            >
              <SearchFilter
                value={search}
                onChange={(value) => {
                  setSearch(value)
                  setPage(1)
                }}
                placeholder="Search a client, a task or a question"
              />
              <SelectFilter
                label="Client"
                allLabel="All clients"
                value={client}
                options={clientOptions}
                onChange={(value) => {
                  setClient(value)
                  setPage(1)
                }}
              />
              <DateRangeFilters
                fromLabel="Run from"
                toLabel="Run to"
                fromDay={fromDay}
                toDay={toDay}
                onFromChange={(day) => {
                  setFromDay(day)
                  setPage(1)
                }}
                onToChange={(day) => {
                  setToDay(day)
                  setPage(1)
                }}
              />
            </FilterPanel>

            {result && total > 0 && (
              <BulkDeleteBar
                pickedCount={selection.pickedIds.size}
                total={total}
                noun={NOUN}
                hasFilters={hasFilters}
                isBusy={isDeletingMany}
                onDeletePicked={() => setConfirmingMany("picked")}
                onDeleteAll={() => setConfirmingMany("all")}
                onClear={selection.clear}
              />
            )}

            {deleteError && (
              <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
                {deleteError}
              </p>
            )}

            {error && !result ? (
              <div role="alert" className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <AlertTriangle size={20} className="text-error" aria-hidden="true" />
                <p className="max-w-sm text-sm text-on-surface-variant">{error}</p>
                <button type="button" onClick={reload} className={pagerButton}>
                  <RefreshCw size={14} aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : !result ? (
              <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
                <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" />
                Loading your batches...
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/5 text-primary">
                  <AudioLines size={20} aria-hidden="true" />
                </div>
                <p className="max-w-sm text-sm text-on-surface-variant">
                  {hasFilters ? CLIENT_VOICES_MESSAGES.noMatches : CLIENT_VOICES_MESSAGES.emptyHistory}
                </p>
              </div>
            ) : (
              <div className={`flex flex-col gap-3 transition-opacity ${isLoading ? "opacity-60" : ""}`} aria-busy={isLoading}>
                {/* The table from xl, where it fits beside the open sidebar; cards below */}
                <div className="hidden overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm xl:block">
                  <table className="w-full min-w-[900px] border-collapse text-left">
                    <caption className="sr-only">
                      Saved voice batches, page {page} of {totalPages}
                    </caption>
                    <thead className="bg-surface-container-lowest">
                      <tr className="border-b border-outline-variant">
                        <th scope="col" className="w-[36px] px-2 py-2.5">
                          <span className="sr-only">Picked</span>
                        </th>
                        {["Title", "When", "Client", "What came out of it", "Actions"].map((heading) => (
                          <th key={heading} scope="col" className={`px-3 py-2.5 ${historyLabelClass} ${heading === "Actions" ? "text-right" : ""}`}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((batch) => (
                        <tr key={batch.id} className="border-b border-outline-variant/60 align-top last:border-b-0 hover:bg-surface-container-lowest">
                          <td className="w-[36px] px-2 py-2.5">
                            <input
                              type="checkbox"
                              checked={selection.isPicked(batch.id)}
                              disabled={isDeletingMany}
                              onChange={(event) => selection.pick(batch.id, (event.nativeEvent as MouseEvent).shiftKey)}
                              aria-label={`Pick ${titleOf(batch)}`}
                              className="h-4 w-4 accent-primary"
                            />
                          </td>
                          <td className="max-w-[320px] px-3 py-2.5">
                            <Link
                              href={clientVoicesBatchHref(batch.id)}
                              className="break-words text-[13px] font-semibold text-on-surface hover:text-primary hover:underline"
                            >
                              {titleOf(batch)}
                            </Link>
                          </td>
                          <td className="max-w-[170px] px-3 py-2.5">
                            <p className="text-[12px] text-on-surface-variant">{runOn(batch.createdAt)}</p>
                          </td>
                          <td className="max-w-[160px] px-3 py-2.5">
                            <ClientTag batch={batch} />
                          </td>
                          <td className="max-w-[210px] px-3 py-2.5">
                            <Counts batch={batch} />
                          </td>
                          <td className="px-3 py-2">{actions(batch)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:hidden">
                  {items.map((batch) => (
                    <li key={batch.id} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <input
                          type="checkbox"
                          checked={selection.isPicked(batch.id)}
                          disabled={isDeletingMany}
                          onChange={(event) => selection.pick(batch.id, (event.nativeEvent as MouseEvent).shiftKey)}
                          aria-label={`Pick ${titleOf(batch)}`}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                        />
                        <Link
                          href={clientVoicesBatchHref(batch.id)}
                          className="min-w-0 flex-1 break-words text-[14px] font-semibold text-on-surface hover:text-primary"
                        >
                          {titleOf(batch)}
                        </Link>
                        <ClientTag batch={batch} />
                      </div>
                      <Counts batch={batch} />
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-outline-variant/70 pt-2">
                        <span className="whitespace-nowrap text-[11px] text-outline">{runOn(batch.createdAt)}</span>
                        {actions(batch)}
                      </div>
                    </li>
                  ))}
                </ul>

                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} isLoading={isLoading} label="Batch pages" />
              </div>
            )}
          </div>
        </main>
      </div>

      {deletingOne && (
        <ConfirmBulkDelete
          count={1}
          noun={NOUN}
          alsoGoes={CLIENT_VOICES_MESSAGES.confirmDeleteBatch}
          isDeleting={isDeletingOne}
          onConfirm={() => void deleteOne(deletingOne)}
          onClose={() => setDeletingOne(null)}
        />
      )}

      {confirmingMany && (
        <ConfirmBulkDelete
          count={confirmingMany === "picked" ? selection.pickedIds.size : total}
          noun={NOUN}
          alsoGoes="Every recording and transcript in them goes too."
          isDeleting={isDeletingMany}
          onConfirm={() => void deleteMany(confirmingMany)}
          onClose={() => setConfirmingMany(null)}
        />
      )}
    </div>
  )
}
