"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertTriangle, CalendarClock, FilePenLine, Loader2, Plus, RefreshCw, Search, SearchX, Video, X } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { MeetingsTable } from "@/components/meetings/MeetingsTable"
import { BulkDeleteBar, ConfirmBulkDelete } from "@/components/ui/BulkDelete"
import { useRowSelection } from "@/hooks/useRowSelection"
import { DeleteMeetingDialog } from "@/components/meetings/DeleteMeetingDialog"
import { MeetingFormDialog } from "@/components/meetings/MeetingFormDialog"
import { MeetingsPromptModal } from "@/components/meetings/MeetingsPromptModal"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import {
  MEETINGS_ENDPOINT,
  MEETING_MESSAGES,
  MEETING_SEARCH_MAX_LENGTH,
  MEETING_STATUSES,
  RUNNING_STATUSES,
  SEARCH_DEBOUNCE_MS,
  type MeetingPromptId,
  type MeetingStatusId,
} from "@/constants/meetings"
import type { Meeting, MeetingInput, MeetingSummary, MeetingsPage } from "@/types/meetings"

// While something is being analyzed, the list checks back this often
const RUNNING_REFRESH_MS = 4000

export default function MeetingsClient() {
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [meetings, setMeetings] = useState<MeetingSummary[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [reloadAttempt, setReloadAttempt] = useState(0)
  const [typedSearch, setTypedSearch] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<MeetingStatusId | "">("")
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [promptTab, setPromptTab] = useState<MeetingPromptId | null>(null)
  // The meeting waiting on a Delete that has been asked for but not confirmed
  const [meetingToDelete, setMeetingToDelete] = useState<MeetingSummary | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // Deleting the ticked meetings, confirmed the same way one meeting is
  const [isConfirmingPicked, setIsConfirmingPicked] = useState(false)
  const [isDeletingPicked, setIsDeletingPicked] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const isFetchingRef = useRef(false)

  // Typing settles before the search runs, so a search is one request rather than one per keystroke
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typedSearch.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [typedSearch])

  const query = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (status) params.set("status", status)
      if (cursor) params.set("cursor", cursor)
      const text = params.toString()
      return text ? `${MEETINGS_ENDPOINT}?${text}` : MEETINGS_ENDPOINT
    },
    [search, status]
  )

  // The first page: on arrival, and whenever the search or the filter changes
  useEffect(() => {
    const controller = new AbortController()
    requestApi<MeetingsPage>(query(), { signal: controller.signal })
      .then(({ data }) => {
        setMeetings(data.meetings)
        setNextCursor(data.nextCursor)
        setTotal(data.total)
        setListError(null)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setListError(error instanceof Error ? error.message : MEETING_MESSAGES.loadFailed)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [query, reloadAttempt])

  const reload = useCallback(() => {
    setIsLoading(true)
    setListError(null)
    setReloadAttempt((attempt) => attempt + 1)
  }, [])

  // A meeting being analyzed anywhere keeps the list fresh without the page being reloaded
  const hasRunning = meetings.some((meeting) => RUNNING_STATUSES.includes(meeting.status))
  useEffect(() => {
    if (!hasRunning) return
    const timer = setInterval(() => setReloadAttempt((attempt) => attempt + 1), RUNNING_REFRESH_MS)
    return () => clearInterval(timer)
  }, [hasRunning])

  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || !nextCursor) return
    isFetchingRef.current = true
    setIsLoadingMore(true)
    try {
      const { data } = await requestApi<MeetingsPage>(query(nextCursor))
      setMeetings((current) => {
        const seen = new Set(current.map((meeting) => meeting.id))
        return [...current, ...data.meetings.filter((meeting) => !seen.has(meeting.id))]
      })
      setNextCursor(data.nextCursor)
      setTotal(data.total)
      setListError(null)
    } catch (error: unknown) {
      setListError(error instanceof Error ? error.message : MEETING_MESSAGES.moreFailed)
    } finally {
      isFetchingRef.current = false
      setIsLoadingMore(false)
    }
  }, [nextCursor, query])

  // The next page loads when the end of the list comes into view
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !nextCursor || isLoadingMore || listError) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore()
      },
      { rootMargin: "300px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [nextCursor, isLoadingMore, listError, loadMore])

  // A new meeting is saved here and opened straight away, where its analysis runs
  const createMeeting = async (input: MeetingInput) => {
    if (isSaving) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const { data } = await requestApi<Meeting>(MEETINGS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }, { idempotent: true })
      setIsCreating(false)
      router.push(`/meetings/${data.id}`)
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : MEETING_MESSAGES.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Deletes one meeting from the list, after the dialog has asked. The row leaves as soon as the
   * server confirms, and the count follows; a delete that fails leaves the meeting where it is and
   * says why, in the dialog it was asked from. The transcript, the analysis and everything the
   * meeting was read into go with it, which is why this always confirms first.
   */
  const confirmDelete = async () => {
    const meeting = meetingToDelete
    if (!meeting || isDeleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await requestApi<{ deleted: number }>(`${MEETINGS_ENDPOINT}/${meeting.id}`, { method: "DELETE" })
      setMeetings((current) => current.filter((entry) => entry.id !== meeting.id))
      setTotal((count) => Math.max(0, count - 1))
      setMeetingToDelete(null)
    } catch (error: unknown) {
      setDeleteError(error instanceof Error ? error.message : MEETING_MESSAGES.deleteFailed)
    } finally {
      setIsDeleting(false)
    }
  }

  const selection = useRowSelection(meetings.map((meeting) => meeting.id))

  /**
   * Deletes the ticked meetings in one call. Each takes its transcript, what was read from it and
   * its chat with it, exactly as deleting one does. Final, so it only runs from the confirmation.
   */
  const deletePicked = async () => {
    if (isDeletingPicked) return
    setIsDeletingPicked(true)
    try {
      await requestApi<{ deleted: number }>(MEETINGS_ENDPOINT, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selection.pickedIds] }),
      })
      selection.clear()
      setIsConfirmingPicked(false)
      reload()
    } catch (error: unknown) {
      setListError(error instanceof Error ? error.message : MEETING_MESSAGES.deleteFailed)
      setIsConfirmingPicked(false)
    } finally {
      setIsDeletingPicked(false)
    }
  }

  const isFiltering = search !== "" || status !== ""

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
                  <CalendarClock size={24} className="text-primary shrink-0" aria-hidden="true" />
                  Meeting Notes to Tasks
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Paste a whole call, however long, and get the decisions, the tasks and a summary to send the client.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <button
                  type="button"
                  onClick={() => setPromptTab("chunk")}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  <FilePenLine size={16} aria-hidden="true" />
                  Update Prompt
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSaveError(null)
                    setIsCreating(true)
                  }}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant"
                >
                  <Plus size={16} aria-hidden="true" />
                  New Meeting
                </button>
                {/* Record the call itself instead of pasting its notes: transcript and notes follow on their own */}
                <Link
                  href="/meetings/record"
                  className="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  <Video size={16} aria-hidden="true" />
                  Record a meeting
                </Link>
              </div>
            </div>

            {/* Search and filter */}
            <div className="flex flex-col gap-2 shrink-0 sm:flex-row sm:items-center">
              <label className="flex w-full items-center gap-2 rounded-xl border border-outline-variant bg-white px-3 py-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 sm:max-w-md">
                <Search size={16} className="shrink-0 text-outline" aria-hidden="true" />
                <input
                  type="search"
                  value={typedSearch}
                  onChange={(event) => {
                    setTypedSearch(event.target.value)
                    setIsLoading(true)
                  }}
                  maxLength={MEETING_SEARCH_MAX_LENGTH}
                  aria-label="Search meetings by name"
                  placeholder="Search meetings by name..."
                  className="w-full bg-transparent text-sm text-on-surface placeholder:text-outline focus:outline-none"
                />
                {typedSearch !== "" && (
                  <button
                    type="button"
                    onClick={() => {
                      setTypedSearch("")
                      setIsLoading(true)
                    }}
                    aria-label="Clear the search"
                    className="rounded-md p-1 text-outline transition-colors hover:bg-surface-container hover:text-primary"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </label>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as MeetingStatusId | "")
                  setIsLoading(true)
                }}
                aria-label="Filter meetings by status"
                className="rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Any status</option>
                {MEETING_STATUSES.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-outline sm:ml-auto" aria-live="polite">
                {total > 0 ? `${total.toLocaleString()} ${isFiltering ? "match" : "saved"}` : ""}
              </p>
            </div>

            {/* The history */}
            {listError && meetings.length === 0 ? (
              <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-error-container text-error">
                  <AlertTriangle size={20} aria-hidden="true" />
                </div>
                <p className="max-w-sm text-sm leading-relaxed text-on-surface-variant">{listError}</p>
                <button
                  type="button"
                  onClick={reload}
                  className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : isLoading && meetings.length === 0 ? (
              <div role="status" className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
                <Loader2 size={22} className="animate-spin text-primary" aria-hidden="true" />
                <p className="text-sm font-semibold text-on-surface">Loading your meetings...</p>
              </div>
            ) : meetings.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/5 text-primary">
                  {isFiltering ? <SearchX size={20} aria-hidden="true" /> : <CalendarClock size={20} aria-hidden="true" />}
                </div>
                <p className="max-w-sm text-sm leading-relaxed text-on-surface-variant">
                  {isFiltering ? MEETING_MESSAGES.noResults : MEETING_MESSAGES.empty}
                </p>
              </div>
            ) : (
              <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
                <BulkDeleteBar
                  pickedCount={selection.pickedIds.size}
                  total={null}
                  noun={{ one: "meeting", many: "meetings" }}
                  isBusy={isDeletingPicked}
                  onDeletePicked={() => setIsConfirmingPicked(true)}
                  onClear={selection.clear}
                />

                <MeetingsTable
                  meetings={meetings}
                  deletingId={isDeleting ? (meetingToDelete?.id ?? null) : null}
                  pickedIds={selection.pickedIds}
                  onPick={selection.pick}
                  onDelete={setMeetingToDelete}
                />

                <div ref={sentinelRef} className="pt-4 text-center text-[11px] text-outline" aria-live="polite">
                  {listError ? (
                    <span role="alert" className="flex items-center justify-center gap-2 text-error">
                      {listError}
                      <button type="button" onClick={reload} className="font-semibold underline hover:no-underline">
                        Try again
                      </button>
                    </span>
                  ) : isLoadingMore ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                      Loading more...
                    </span>
                  ) : nextCursor ? (
                    <button type="button" onClick={loadMore} className="font-semibold text-primary underline hover:no-underline">
                      Load more
                    </button>
                  ) : (
                    <span>That is everything.</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {isCreating && (
        <MeetingFormDialog
          meeting={null}
          isSaving={isSaving}
          error={saveError}
          onSave={createMeeting}
          onClose={() => {
            if (isSaving) return
            setIsCreating(false)
            setSaveError(null)
          }}
        />
      )}
      {isConfirmingPicked && (
        <ConfirmBulkDelete
          count={selection.pickedIds.size}
          noun={{ one: "meeting", many: "meetings" }}
          alsoGoes="The transcript, the analysis and the chat go with each one."
          isDeleting={isDeletingPicked}
          onConfirm={() => void deletePicked()}
          onClose={() => setIsConfirmingPicked(false)}
        />
      )}
      {meetingToDelete && (
        <DeleteMeetingDialog
          meeting={meetingToDelete}
          isDeleting={isDeleting}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onClose={() => {
            if (isDeleting) return
            setMeetingToDelete(null)
            setDeleteError(null)
          }}
        />
      )}
      {promptTab && <MeetingsPromptModal initialTab={promptTab} onClose={() => setPromptTab(null)} />}
    </div>
  )
}
