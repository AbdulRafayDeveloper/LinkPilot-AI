"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertCircle, AlertTriangle, CalendarDays, CheckCircle2, ExternalLink, Link2, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { Modal } from "@/components/ui/Modal"
import { Pagination } from "@/components/ui/Pagination"
import { BulkDeleteBar, ConfirmBulkDelete } from "@/components/ui/BulkDelete"
import { FilterPanel, SearchFilter, SelectFilter, historyLabelClass } from "@/components/history/HistoryFilters"
import { ProfileScheduleFields } from "@/components/comment-writer/ProfileScheduleFields"
import { ProfileScheduleDialog } from "@/components/comment-writer/ProfileScheduleDialog"
import { OpenAllProfiles } from "@/components/comment-writer/OpenAllProfiles"
import { useRowSelection } from "@/hooks/useRowSelection"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { requestApi } from "@/lib/apiClient"
import { EMPTY_PERSON, personInputProblem, personName, typeLabel } from "@/lib/profilePeople"
import { HISTORY_DEBOUNCE_MS } from "@/constants/historyFilters"
import {
  DAY_PARAM,
  PERSON_TYPES,
  PROFILE_PARAM,
  PROFILE_SCHEDULER_MESSAGES,
  PROFILE_SCHEDULES_ENDPOINT,
  WEEK_DAYS,
  type PersonTypeId,
  type WeekDayId,
} from "@/constants/profileScheduler"
import type { ProfileSchedule, ProfileScheduleInput, ProfileSchedulePage } from "@/types/profileScheduler"

/**
 * What the page remembers while the app is open: the day and type filters, the search, the page and the add
 * form's draft. It lives in this module rather than in browser storage on purpose, so moving to
 * another page and back keeps it, while a full reload of the browser starts it fresh.
 */
interface Remembered {
  day: WeekDayId | ""
  type: PersonTypeId | ""
  search: string
  page: number
  draft: ProfileScheduleInput
}
const remembered: Remembered = { day: "", type: "", search: "", page: 1, draft: EMPTY_PERSON }

function useRemembered<K extends keyof Remembered>(key: K) {
  const [value, setValue] = useState<Remembered[K]>(() => remembered[key])
  const set = useCallback(
    (next: Remembered[K]) => {
      remembered[key] = next
      setValue(next)
    },
    [key]
  )
  return [value, set] as const
}

const NOUN = { one: "person", many: "people" }

const addedOn = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })

// Comment Writer, told which profile (and which day, when one is chosen here) is being commented on
const openHref = (profileUrl: string, day: WeekDayId | "") => {
  const params = new URLSearchParams({ [PROFILE_PARAM]: profileUrl })
  if (day) params.set(DAY_PARAM, day)
  return `/comment-writer?${params.toString()}`
}

// Why each person is on the list, as short tags
const TypeTags: React.FC<{ types: PersonTypeId[] }> = ({ types }) =>
  types.length === 0 ? (
    <span className="text-[12px] text-outline">No type</span>
  ) : (
    <ul className="flex flex-wrap gap-1" aria-label={`Type: ${types.map(typeLabel).join(", ")}`}>
      {types.map((type) => (
        <li key={type} aria-hidden="true" className="rounded-full bg-secondary-fixed px-2 py-0.5 text-[11px] font-semibold text-on-secondary-fixed-variant">
          {typeLabel(type)}
        </li>
      ))}
    </ul>
  )

const actionButton =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-semibold text-outline transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
const pagerButton =
  "inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"

// A profile's days as short tags, the one the filter is on picked out, every day named in full for a screen reader
const DayTags: React.FC<{ days: WeekDayId[]; highlight: WeekDayId | "" }> = ({ days, highlight }) => (
  <ul className="flex flex-wrap gap-1" aria-label={`Days: ${WEEK_DAYS.filter((day) => days.includes(day.id)).map((day) => day.label).join(", ")}`}>
    {WEEK_DAYS.filter((day) => days.includes(day.id)).map((day) => (
      <li
        key={day.id}
        aria-hidden="true"
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          day.id === highlight ? "bg-primary text-white" : "bg-primary-fixed/70 text-on-primary-fixed-variant"
        }`}
      >
        {day.short}
      </li>
    ))}
  </ul>
)

/**
 * Profile Scheduler, a page of Comment Writer: the LinkedIn profiles worth commenting on and the
 * days of the week each one is looked at. Search and the day filter run on the server, 50 to a page;
 * Open takes a profile to Comment Writer, which links to its posts; Open all opens every profile on
 * the page, as the search, the day and the page leave it, straight on LinkedIn (OpenAllProfiles).
 */
export default function ProfileSchedulerClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const [day, setDay] = useRemembered("day")
  const [type, setType] = useRemembered("type")
  const [search, setSearch] = useRemembered("search")
  const [page, setPage] = useRemembered("page")
  const [draft, setDraft] = useRemembered("draft")
  const [result, setResult] = useState<ProfileSchedulePage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [answered, setAnswered] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [addError, setAddError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [editing, setEditing] = useState<ProfileSchedule | null>(null)
  const [deleting, setDeleting] = useState<ProfileSchedule | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmingMany, setConfirmingMany] = useState<"picked" | "all" | null>(null)
  const [isDeletingMany, setIsDeletingMany] = useState(false)
  const urlRef = useRef<HTMLInputElement>(null)

  // Typing settles before the list is asked for again, and an emptied search box counts at once
  const settledSearch = useDebouncedValue(search.trim(), HISTORY_DEBOUNCE_MS)
  const params = new URLSearchParams({ page: String(page) })
  if (search.trim() && settledSearch) params.set("search", settledSearch)
  if (day) params.set("day", day)
  if (type) params.set("type", type)
  const query = params.toString()
  const requestKey = `${query}#${attempt}`
  const isLoading = answered !== requestKey

  useEffect(() => {
    // A newer request replaces the one on its way, so a slow answer never overwrites a newer one
    const controller = new AbortController()
    requestApi<ProfileSchedulePage>(`${PROFILE_SCHEDULES_ENDPOINT}?${query}`, { signal: controller.signal })
      .then(({ data }) => {
        setResult(data)
        setError(null)
        // The server clamps a page past the end, and the pager follows it
        if (data.page !== page) setPage(data.page)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : PROFILE_SCHEDULER_MESSAGES.loadFailed)
      })
      .finally(() => {
        if (!controller.signal.aborted) setAnswered(requestKey)
      })
    return () => controller.abort()
  }, [query, requestKey, page, setPage])

  const reload = () => setAttempt((count) => count + 1)
  const hasFilters = Boolean(search || day || type)
  const selection = useRowSelection((result?.items ?? []).map((schedule) => schedule.id))
  const items = result?.items ?? []
  const total = result?.total ?? 0
  const pageSize = result?.pageSize ?? 0
  const totalPages = result?.totalPages ?? 1
  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1
  const lastShown = Math.min(total, (page - 1) * pageSize + items.length)
  const dayOptions = WEEK_DAYS.map((entry) => ({ id: entry.id, label: `${entry.label} (${result?.dayCounts[entry.id] ?? 0})` }))
  const typeOptions = PERSON_TYPES.map((entry) => ({ id: entry.id, label: `${entry.label} (${result?.typeCounts[entry.id] ?? 0})` }))
  // Open all reaches only the people whose LinkedIn link has been found
  const linkedUrls = items.flatMap((schedule) => (schedule.profileUrl ? [schedule.profileUrl] : []))

  /** Adds the profile in the form. The days are kept for the next one, since a batch is often added for the same days. */
  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isAdding) return
    const problem = personInputProblem(draft)
    if (problem) {
      setAddError(problem)
      setNotice(null)
      if (problem === PROFILE_SCHEDULER_MESSAGES.badUrl) urlRef.current?.focus()
      return
    }
    setIsAdding(true)
    setAddError(null)
    setNotice(null)
    try {
      await requestApi<ProfileSchedule>(
        PROFILE_SCHEDULES_ENDPOINT,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) },
        { idempotent: true }
      )
      setDraft({ ...EMPTY_PERSON, days: draft.days, types: draft.types })
      setNotice(PROFILE_SCHEDULER_MESSAGES.created)
      setPage(1)
      reload()
      urlRef.current?.focus()
    } catch (reason: unknown) {
      setAddError(reason instanceof Error ? reason.message : PROFILE_SCHEDULER_MESSAGES.saveFailed)
    } finally {
      setIsAdding(false)
    }
  }

  // An edit is refused in the dialog, which stays open and shows why
  const saveEdit = async (input: ProfileScheduleInput) => {
    if (!editing) return
    const problem = personInputProblem(input)
    if (problem) throw new Error(problem)
    await requestApi<ProfileSchedule>(`${PROFILE_SCHEDULES_ENDPOINT}/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    setEditing(null)
    setNotice(PROFILE_SCHEDULER_MESSAGES.updated)
    reload()
  }

  const remove = async () => {
    if (!deleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await requestApi(`${PROFILE_SCHEDULES_ENDPOINT}/${deleting.id}`, { method: "DELETE" })
      setDeleting(null)
      setNotice(PROFILE_SCHEDULER_MESSAGES.deleted)
      reload()
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : PROFILE_SCHEDULER_MESSAGES.deleteFailed)
    } finally {
      setIsDeleting(false)
    }
  }

  /** Deletes the ticked profiles, or every profile the search and day cover. Final, so only from the confirmation. */
  const deleteMany = async (which: "picked" | "all") => {
    if (isDeletingMany) return
    setIsDeletingMany(true)
    setDeleteError(null)
    try {
      const { data } = await requestApi<{ deleted: number }>(`${PROFILE_SCHEDULES_ENDPOINT}?${query}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(which === "picked" ? { ids: [...selection.pickedIds] } : { all: true }),
      })
      selection.clear()
      setConfirmingMany(null)
      setNotice(`${data.deleted} ${data.deleted === 1 ? NOUN.one : NOUN.many} deleted.`)
      setPage(1)
      reload()
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : PROFILE_SCHEDULER_MESSAGES.deleteFailed)
      setConfirmingMany(null)
    } finally {
      setIsDeletingMany(false)
    }
  }

  const pickBox = (schedule: ProfileSchedule, extra = "") => (
    <input
      type="checkbox"
      checked={selection.isPicked(schedule.id)}
      disabled={isDeletingMany}
      onChange={(event) => selection.pick(schedule.id, (event.nativeEvent as MouseEvent).shiftKey)}
      aria-label={`Pick ${personName(schedule)}`}
      className={`h-4 w-4 accent-primary ${extra}`}
    />
  )

  const actions = (schedule: ProfileSchedule) => {
    const name = personName(schedule)
    return (
      <div className="flex flex-wrap items-center justify-end gap-0.5">
        {schedule.profileUrl ? (
          <Link href={openHref(schedule.profileUrl, day)} aria-label={`Open ${name} in Comment Writer`} className={`${actionButton} text-primary hover:text-primary`}>
            <ExternalLink size={13} aria-hidden="true" />
            Open
          </Link>
        ) : (
          <button type="button" onClick={() => setEditing(schedule)} aria-label={`Add the LinkedIn link of ${name}`} className={`${actionButton} text-primary hover:text-primary`}>
            <Link2 size={13} aria-hidden="true" />
            Add link
          </button>
        )}
        <button type="button" onClick={() => setEditing(schedule)} aria-label={`Edit ${name}`} className={`${actionButton} hover:text-primary`}>
          <Pencil size={13} aria-hidden="true" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => {
            setDeleteError(null)
            setDeleting(schedule)
          }}
          aria-label={`Delete ${name}`}
          className={`${actionButton} hover:text-error`}
        >
          <Trash2 size={13} aria-hidden="true" />
          Delete
        </button>
      </div>
    )
  }

  const profileCell = (schedule: ProfileSchedule) => {
    const about = [schedule.role, schedule.company].filter(Boolean).join(", ")
    const place = [schedule.location, schedule.sector].filter(Boolean).join(" · ")
    const whyNow = [schedule.whyNow, schedule.whyNowDate].filter(Boolean).join(" · ")
    return (
      <div className="min-w-0">
        <p className="break-words text-[13px] font-semibold text-on-surface">{personName(schedule)}</p>
        {about && <p className="break-words text-[12px] text-on-surface-variant">{about}</p>}
        {place && <p className="break-words text-[12px] text-on-surface-variant">{place}</p>}
        {whyNow && (
          <p className="break-words text-[12px] text-on-surface-variant">
            <span className="font-semibold text-on-surface">Why now:</span> {whyNow}
          </p>
        )}
        {schedule.notes && <p className="break-words text-[12px] italic text-on-surface-variant">{schedule.notes}</p>}
        {schedule.profileUrl ? (
          <a href={schedule.profileUrl} target="_blank" rel="noopener noreferrer" className="break-all text-[12px] text-primary hover:underline">
            {schedule.profileUrl}
          </a>
        ) : (
          <p className="text-[12px] italic text-outline">No LinkedIn link yet</p>
        )}
        {schedule.source && (
          <a href={schedule.source} target="_blank" rel="noopener noreferrer" className="block break-all text-[11px] text-outline hover:underline">
            Source: {schedule.source}
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 md:p-6 lg:p-8">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                <CalendarDays size={24} className="shrink-0 text-primary" aria-hidden="true" />
                Profile Scheduler
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">The people you comment on, why each is on your list, and the days you look at their posts.</p>
            </div>

            <form onSubmit={add} noValidate className="flex flex-col gap-4 rounded-2xl border border-outline-variant bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-[15px] font-bold text-on-surface">Add a person</h2>
              <ProfileScheduleFields
                idPrefix="add-profile"
                value={draft}
                onChange={(next) => {
                  setDraft(next)
                  setAddError(null)
                }}
                disabled={isAdding}
                urlRef={urlRef}
              />
              {addError && (
                <p role="alert" className="flex gap-2 rounded-xl bg-error-container px-3 py-2.5 text-[13px] text-error">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  {addError}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p role="status" className="flex items-center gap-1.5 text-[13px] text-on-success-container">
                  {notice && (
                    <>
                      <CheckCircle2 size={15} className="text-success" aria-hidden="true" />
                      {notice}
                    </>
                  )}
                </p>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
                >
                  {isAdding ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                  Add person
                </button>
              </div>
            </form>

            <FilterPanel
              columnsClassName="lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"
              canClear={hasFilters}
              onClear={() => {
                setSearch("")
                setDay("")
                setType("")
                setPage(1)
              }}
              summary={result ? `Showing ${firstShown.toLocaleString()} to ${lastShown.toLocaleString()} of ${total.toLocaleString()}` : "Loading your profiles..."}
            >
              <SearchFilter
                value={search}
                onChange={(value) => {
                  setSearch(value)
                  setPage(1)
                }}
                placeholder="Search by name, role, company, sector, why now or link"
              />
              <SelectFilter
                label="Day"
                allLabel="Every day"
                value={day}
                options={dayOptions}
                onChange={(value) => {
                  setDay(value as WeekDayId | "")
                  setPage(1)
                }}
              />
              <SelectFilter
                label="Type"
                allLabel="Every type"
                value={type}
                options={typeOptions}
                onChange={(value) => {
                  setType(value as PersonTypeId | "")
                  setPage(1)
                }}
              />
            </FilterPanel>

            {linkedUrls.length > 0 && <OpenAllProfiles urls={linkedUrls} listKey={requestKey} disabled={isLoading} buttonClassName={pagerButton} />}

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

            {deleteError && !deleting && (
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
                Loading your profiles...
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/5 text-primary">
                  <CalendarDays size={20} aria-hidden="true" />
                </div>
                <p className="max-w-sm text-sm text-on-surface-variant">{hasFilters ? PROFILE_SCHEDULER_MESSAGES.noResults : PROFILE_SCHEDULER_MESSAGES.empty}</p>
              </div>
            ) : (
              <div className={`flex flex-col gap-3 transition-opacity ${isLoading ? "opacity-60" : ""}`} aria-busy={isLoading}>
                {error && (
                  <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
                    {error}
                  </p>
                )}

                {/* The table from xl, where it fits beside the open sidebar; cards below, two to a row on a tablet */}
                <div className="hidden overflow-x-auto rounded-2xl border border-outline-variant bg-white shadow-sm xl:block">
                  <table className="w-full min-w-[880px] border-collapse text-left">
                    <caption className="sr-only">Scheduled profiles, page {page} of {totalPages}</caption>
                    <thead className="bg-surface-container-lowest">
                      <tr className="border-b border-outline-variant">
                        <th scope="col" className="w-[36px] px-2 py-2.5">
                          <span className="sr-only">Picked</span>
                        </th>
                        {["Person", "Type", "Days", "Added", "Actions"].map((heading) => (
                          <th key={heading} scope="col" className={`px-3 py-2.5 ${historyLabelClass} ${heading === "Actions" ? "text-right" : ""}`}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((schedule) => (
                        <tr key={schedule.id} className="border-b border-outline-variant/60 align-top last:border-b-0 hover:bg-surface-container-lowest">
                          <td className="w-[36px] px-2 py-2.5">{pickBox(schedule)}</td>
                          <td className="max-w-[380px] px-3 py-2.5">{profileCell(schedule)}</td>
                          <td className="px-3 py-2.5">
                            <TypeTags types={schedule.types} />
                          </td>
                          <td className="px-3 py-2.5">
                            <DayTags days={schedule.days} highlight={day} />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-on-surface-variant">{addedOn(schedule.createdAt)}</td>
                          <td className="px-3 py-2">{actions(schedule)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:hidden">
                  {items.map((schedule) => (
                    <li key={schedule.id} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-outline-variant bg-white p-3 shadow-sm">
                      <div className="flex items-start gap-2">
                        {pickBox(schedule, "mt-0.5 shrink-0")}
                        {profileCell(schedule)}
                      </div>
                      <TypeTags types={schedule.types} />
                      <DayTags days={schedule.days} highlight={day} />
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-outline-variant/70 pt-2">
                        <span className="whitespace-nowrap text-[11px] text-outline">Added {addedOn(schedule.createdAt)}</span>
                        {actions(schedule)}
                      </div>
                    </li>
                  ))}
                </ul>

                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} isLoading={isLoading} />
              </div>
            )}
          </div>
        </main>
      </div>

      {confirmingMany && (
        <ConfirmBulkDelete
          count={confirmingMany === "picked" ? selection.pickedIds.size : total}
          noun={NOUN}
          alsoGoes={confirmingMany === "all" && hasFilters ? "Everyone matching the search, the day and the type goes, including people on the other pages." : undefined}
          isDeleting={isDeletingMany}
          onConfirm={() => void deleteMany(confirmingMany)}
          onClose={() => setConfirmingMany(null)}
        />
      )}

      {editing && <ProfileScheduleDialog schedule={editing} onSave={saveEdit} onClose={() => setEditing(null)} />}

      {deleting && (
        <Modal
          title={`Delete ${personName(deleting)}?`}
          description="This removes the person, their details and their days from your list. The comments already written stay where they are."
          onClose={() => setDeleting(null)}
          isCloseDisabled={isDeleting}
          size="compact"
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleting(null)} disabled={isDeleting} className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold hover:bg-surface-container-high">
                Cancel
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-xl bg-error px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {isDeleting && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                Delete person
              </button>
            </div>
          }
        >
          {deleteError ? (
            <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[13px] text-error">
              {deleteError}
            </p>
          ) : (
            <div className="flex flex-col gap-2 text-sm text-on-surface-variant">
              <p className="break-all">{deleting.profileUrl ?? "No LinkedIn link"}</p>
              <DayTags days={deleting.days} highlight="" />
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
