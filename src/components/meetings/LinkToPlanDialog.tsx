"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Link2, Loader2, Repeat, Search } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { requestApi } from "@/lib/apiClient"
import { HISTORY_DEBOUNCE_MS } from "@/constants/historyFilters"
import {
  MEETING_PLAN_LINK_MESSAGES,
  PLAN_PICK_ENDPOINT,
  PLAN_PICK_REPEAT,
  PLAN_PICK_WHEN,
  type PlanPickRepeat,
  type PlanPickWhen,
} from "@/constants/meetings"
import { dayLabel, formatTime, monthLabel, todayIso } from "@/lib/meetingDates"
import type { PlanPickGroup, PlanPickOccurrence, PlanPickPage } from "@/types/meetings"

interface LinkToPlanDialogProps {
  // How many records are being linked, for the title
  count: number
  isSaving: boolean
  error: string | null
  onSubmit: (planId: string) => void
  onClose: () => void
}

/** What the picker is choosing between: the meetings, or the dates of the one that was opened. */
interface Chosen {
  id: string
  label: string
}

const words = MEETING_PLAN_LINK_MESSAGES
const shortDay = (date: string) => dayLabel(date, { weekday: "short", day: "numeric", month: "short" })
const plainDay = (date: string) => dayLabel(date, { weekday: undefined, day: "numeric", month: "short", year: undefined })
const fieldClass =
  "h-10 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[13px] text-on-surface focus:border-primary focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"

/** Back, the page it is on, and Next: the same strip under both lists. */
const Pager: React.FC<{ page: number; pages: number; total: number; onPage: (page: number) => void; busy: boolean }> = ({
  page,
  pages,
  total,
  onPage,
  busy,
}) =>
  pages <= 1 ? (
    <p className="px-1 text-[11px] text-outline">{total === 1 ? "1 meeting" : `${total.toLocaleString()} meetings`}</p>
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
      <p className="text-[11px] text-outline">{words.page(page, pages)}</p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={busy || page <= 1}
          className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-2.5 py-1 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-40"
        >
          <ChevronLeft size={13} aria-hidden="true" />
          {words.previousPage}
        </button>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={busy || page >= pages}
          className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-2.5 py-1 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-40"
        >
          {words.nextPage}
          <ChevronRight size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
  )

const rowClass = (isChosen: boolean) =>
  `flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition-colors ${
    isChosen ? "bg-primary-container text-on-primary-container" : "text-on-surface hover:bg-surface-container-low"
  }`

/**
 * Which meeting on the calendar these notes or this recording are of.
 *
 * **One row per meeting, not per date.** A repeating meeting is stored as one meeting per week, so
 * the picker used to list the same name over and over; the rows are grouped by series now, and a
 * repeating one opens on its own dates with Back and Next, which is where the exact week is chosen.
 *
 * **The whole calendar is reachable**, past and upcoming: the list is filtered, searched and paged
 * in the database (`/api/meeting-planner/pick`) rather than read three months at a time, with the
 * meeting nearest today first, since a record is usually of one that has just been held.
 */
export const LinkToPlanDialog: React.FC<LinkToPlanDialogProps> = ({ count, isSaving, error, onSubmit, onClose }) => {
  const [typed, setTyped] = useState("")
  const [search, setSearch] = useState("")
  const [when, setWhen] = useState<PlanPickWhen>("all")
  const [repeat, setRepeat] = useState<PlanPickRepeat>("all")
  // One month of the calendar, or "" for every one of them
  const [month, setMonth] = useState("")
  const [page, setPage] = useState(1)
  /**
   * Each answer is kept with the request it was read for, so a page still arriving never shows under
   * another filter and nothing has to be emptied as an effect starts (which is a cascading render).
   */
  const [groups, setGroups] = useState<{ key: string; data: PlanPickPage<PlanPickGroup> } | null>(null)
  // The repeating meeting whose dates are open, or null while the list of meetings is on screen
  const [openGroup, setOpenGroup] = useState<PlanPickGroup | null>(null)
  const [datePage, setDatePage] = useState(1)
  const [dates, setDates] = useState<{ key: string; data: PlanPickPage<PlanPickOccurrence> } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [chosen, setChosen] = useState<Chosen | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const today = useMemo(() => todayIso(), [])

  // Typing settles before the list is read again, the pause every other list here waits
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed), typed ? HISTORY_DEBOUNCE_MS : 0)
    return () => clearTimeout(timer)
  }, [typed])

  const filters = `today=${today}&when=${when}&repeat=${repeat}${month ? `&month=${month}` : ""}`
  const groupsQuery = `${filters}&search=${encodeURIComponent(search)}&page=${page}`
  const datesQuery = openGroup?.seriesId ? `${filters}&series=${openGroup.seriesId}&page=${datePage}` : null
  const shownGroups = groups?.key === groupsQuery ? groups.data : null
  const shownDates = datesQuery && dates?.key === datesQuery ? dates.data : null

  // The meetings, grouped. Read again whenever the filters, the search or the page change
  useEffect(() => {
    if (openGroup) return
    const controller = new AbortController()
    requestApi<PlanPickPage<PlanPickGroup>>(`${PLAN_PICK_ENDPOINT}?${groupsQuery}`, {
      signal: controller.signal,
    })
      .then(({ data }) => {
        setGroups({ key: groupsQuery, data })
        setLoadError(null)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(reason instanceof Error ? reason.message : words.linkFailed)
      })
    return () => controller.abort()
  }, [groupsQuery, openGroup])

  // The dates of the meeting that was opened
  useEffect(() => {
    if (!datesQuery) return
    const controller = new AbortController()
    requestApi<PlanPickPage<PlanPickOccurrence>>(`${PLAN_PICK_ENDPOINT}?${datesQuery}`, { signal: controller.signal })
      .then(({ data }) => {
        setDates({ key: datesQuery, data })
        setLoadError(null)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(reason instanceof Error ? reason.message : words.linkFailed)
      })
    return () => controller.abort()
  }, [datesQuery])

  /** Any change to what is being looked at starts the list again from its first page. */
  const narrow = (change: () => void) => {
    change()
    setPage(1)
    setDatePage(1)
  }

  const openDates = (group: PlanPickGroup) => {
    setOpenGroup(group)
    setDatePage(1)
  }

  /**
   * The months to choose from come with the answer on screen, so inside a repeating meeting they are
   * that meeting's own months. A month chosen before one was opened is kept in the list even when it
   * holds nothing there, or the field would show a value it does not offer.
   */
  const shown = openGroup ? shownDates : shownGroups
  const months = useMemo(() => {
    const offered = shown?.months ?? (month ? [{ month, count: 0 }] : [])
    return offered.some((entry) => entry.month === month) || !month ? offered : [{ month, count: 0 }, ...offered]
  }, [shown, month])

  const isLoading = openGroup ? shownDates === null : shownGroups === null
  const busy = isSaving || isLoading

  return (
    <Modal
      title={words.choose}
      description={`${count} ${count === 1 ? "record" : "records"} will point at it. ${words.chooseHint}`}
      onClose={onClose}
      isCloseDisabled={isSaving}
      initialFocusRef={input}
      size="compact"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-[20px] min-w-0">
            {error ? (
              <p role="alert" className="text-xs text-error">
                {error}
              </p>
            ) : (
              chosen && (
                <p className="truncate text-xs text-on-surface-variant">
                  <span className="font-semibold text-on-surface">{words.chosenIs}:</span> {chosen.label}
                </p>
              )
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => chosen && onSubmit(chosen.id)}
              disabled={isSaving || !chosen}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Link2 size={15} aria-hidden="true" />}
              {words.link}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/* The search and the filters, which stay as they are while a meeting's dates are open */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline" aria-hidden="true" />
            <input
              ref={input}
              value={typed}
              onChange={(event) => narrow(() => setTyped(event.target.value))}
              placeholder={words.searchHint}
              aria-label={words.search}
              className={`${fieldClass} w-full pl-9`}
              disabled={isSaving}
            />
          </div>
          <label className="sr-only" htmlFor="plan-pick-when">
            {words.search}
          </label>
          <select
            id="plan-pick-when"
            value={when}
            onChange={(event) => narrow(() => setWhen(event.target.value as PlanPickWhen))}
            disabled={isSaving}
            className={fieldClass}
          >
            {PLAN_PICK_WHEN.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Repeating or one-off"
            value={repeat}
            onChange={(event) => narrow(() => setRepeat(event.target.value as PlanPickRepeat))}
            disabled={isSaving || Boolean(openGroup)}
            className={fieldClass}
          >
            {PLAN_PICK_REPEAT.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
          {/* The months that really hold meetings, newest first; it narrows the dates of one
              repeating meeting too, which is the same field doing the same job */}
          <select
            aria-label={words.monthFilter}
            value={month}
            onChange={(event) => narrow(() => setMonth(event.target.value))}
            disabled={isSaving}
            className={fieldClass}
          >
            <option value="">{words.anyMonth}</option>
            {months.map((entry) => (
              <option key={entry.month} value={entry.month}>
                {words.inMonth(monthLabel(entry.month), entry.count)}
              </option>
            ))}
          </select>
        </div>

        {loadError && (
          <p role="alert" className="flex gap-2 rounded-xl bg-error-container px-3 py-2.5 text-[13px] text-error">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {loadError}
          </p>
        )}

        {/* The meeting whose dates are open, with the way back to the list */}
        {openGroup && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-container-lowest px-3 py-2">
            <button
              type="button"
              onClick={() => setOpenGroup(null)}
              className="inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
            >
              <ChevronLeft size={13} aria-hidden="true" />
              {words.backToList}
            </button>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-on-surface">{openGroup.name}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-fixed px-2 py-0.5 text-[11px] font-semibold text-on-primary-fixed-variant">
              <Repeat size={11} aria-hidden="true" />
              {words.repeats(openGroup.pattern ?? "", openGroup.count)}
            </span>
          </div>
        )}

        {isLoading && !loadError ? (
          <p role="status" className="flex items-center gap-2 py-6 text-[13px] text-on-surface-variant">
            <Loader2 size={16} className="animate-spin text-primary" aria-hidden="true" />
            Loading the calendar...
          </p>
        ) : openGroup ? (
          <>
            <ul className="custom-scrollbar flex max-h-72 flex-col gap-1 overflow-y-auto">
              {(shownDates?.rows ?? []).map((date) => {
                const isChosen = date.id === chosen?.id
                return (
                  <li key={date.id}>
                    <button
                      type="button"
                      onClick={() => setChosen({ id: date.id, label: `${openGroup.name} · ${shortDay(date.meetingDate)}` })}
                      aria-pressed={isChosen}
                      className={rowClass(isChosen)}
                    >
                      <CalendarDays size={14} className="mt-0.5 shrink-0 text-outline" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">
                          {shortDay(date.meetingDate)} at {formatTime(date.meetingTime)}
                        </span>
                        <span className={`block text-[11px] ${isChosen ? "text-on-primary-container/80" : "text-outline"}`}>
                          {date.status === "cancelled" ? "Cancelled" : date.status === "completed" ? "Completed" : "Pending"}
                          {date.linkedCount > 0 ? ` · ${words.notesOn(date.linkedCount)} already` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <Pager page={shownDates?.page ?? 1} pages={shownDates?.pages ?? 1} total={shownDates?.total ?? 0} onPage={setDatePage} busy={busy} />
          </>
        ) : (shownGroups?.rows.length ?? 0) === 0 ? (
          <p className="rounded-xl border border-dashed border-outline-variant px-3 py-6 text-center text-[13px] text-outline">
            {search.trim() ? words.noMatch : when !== "all" || repeat !== "all" || month ? words.nothingHere : words.noneToLink}
          </p>
        ) : (
          <>
            <ul className="custom-scrollbar flex max-h-72 flex-col gap-1 overflow-y-auto">
              {(shownGroups?.rows ?? []).map((group) => {
                const isSeries = Boolean(group.seriesId)
                const isChosen = !isSeries && group.meetingId === chosen?.id
                return (
                  <li key={group.key}>
                    <button
                      type="button"
                      onClick={() =>
                        isSeries
                          ? openDates(group)
                          : setChosen({ id: group.meetingId, label: `${group.name} · ${shortDay(group.meetingDate)}` })
                      }
                      aria-pressed={isSeries ? undefined : isChosen}
                      aria-label={isSeries ? `${words.openSeries}: ${group.name}` : undefined}
                      className={rowClass(isChosen)}
                    >
                      {isSeries ? (
                        <Repeat size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                      ) : (
                        <CalendarDays size={14} className="mt-0.5 shrink-0 text-outline" aria-hidden="true" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">{group.name}</span>
                        <span className={`block text-[11px] ${isChosen ? "text-on-primary-container/80" : "text-outline"}`}>
                          {isSeries
                            ? `${words.repeats(group.pattern ?? "", group.count)} · ${words.between(plainDay(group.firstDate), plainDay(group.lastDate))}`
                            : `${shortDay(group.meetingDate)} at ${formatTime(group.meetingTime)}`}
                          {group.personName ? ` · ${group.personName}` : ""}
                          {!isSeries && group.linkedCount > 0 ? ` · ${words.notesOn(group.linkedCount)} already` : ""}
                        </span>
                      </span>
                      {isSeries && <ChevronRight size={15} className="mt-0.5 shrink-0 text-outline" aria-hidden="true" />}
                    </button>
                  </li>
                )
              })}
            </ul>
            <Pager page={shownGroups?.page ?? 1} pages={shownGroups?.pages ?? 1} total={shownGroups?.total ?? 0} onPage={setPage} busy={busy} />
          </>
        )}
      </div>
    </Modal>
  )
}
