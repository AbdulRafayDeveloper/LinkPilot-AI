"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, EyeOff, ListChecks, Loader2, RefreshCw, Trash2 } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { Pagination } from "@/components/ui/Pagination"
import { BulkDeleteBar, ConfirmBulkDelete } from "@/components/ui/BulkDelete"
import { DateRangeFilters, FilterPanel, SearchFilter, SearchableSelectFilter, SelectFilter, historyLabelClass } from "@/components/history/HistoryFilters"
import { StatCard, dateTime, timeAgo } from "@/components/admin/AdminParts"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { useSavedFilters } from "@/hooks/useSavedFilters"
import { useRowSelection } from "@/hooks/useRowSelection"
import { filtersOf, oneOf, savedDay, savedText, type SavedFilters } from "@/lib/savedFilters"
import { requestApi } from "@/lib/apiClient"
import { appendDayRange, isBackwardsRange } from "@/lib/dayRange"
import { deviceLabel } from "@/lib/userAgent"
import { HISTORY_DEBOUNCE_MS, HISTORY_MESSAGES } from "@/constants/historyFilters"
import { USERS_HREF } from "@/constants/admin"
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ACTION_IDS,
  ACTIVITY_LOGS_ENDPOINT,
  ACTIVITY_MESSAGES,
  ACTIVITY_OUTCOMES,
  ACTIVITY_OUTCOME_IDS,
  ACTIVITY_STATES,
  ACTIVITY_STATE_IDS,
  adminActivitiesEndpoint,
} from "@/constants/activityLogs"
import type { ActivityDeletion, ActivityEntry, ActivityPage, AdminActivityPage } from "@/types/activityLogs"

/**
 * One account's activities, newest first, 50 to a page, searched and filtered in the database. The
 * same view serves two readers:
 *
 * - **the person themselves** (`/activity-logs`): their own activities, without the ones they
 *   deleted. Their delete hides an activity from their list and keeps it for the administrators, so
 *   one row goes on one click, and a group goes after a confirmation that says it is kept.
 * - **an admin** (`/admin/users/<id>/activities`): every activity of that account, the deleted ones
 *   included and marked, with a filter for them. An admin's delete is permanent, so it always confirms.
 */

type Props = { mode: "own" } | { mode: "admin"; userId: string }

const NOUN = { one: "activity", many: "activities" }

// Where each reader's filters are kept on their account (constants/savedFilters.ts)
const SAVED_VIEW = { own: { view: "activity-logs" }, admin: { view: "admin-user-activities" } } as const

const OutcomeBadge: React.FC<{ entry: ActivityEntry }> = ({ entry }) =>
  entry.outcome === "refused" ? (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-error-container px-2 py-0.5 text-[11px] font-semibold text-error">
      <Ban size={12} aria-hidden="true" />
      Refused
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-success-container px-2 py-0.5 text-[11px] font-semibold text-on-success-container">
      <CheckCircle2 size={12} aria-hidden="true" />
      Allowed
    </span>
  )

const DeletedBadge: React.FC<{ at: string }> = ({ at }) => (
  <span
    className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-secondary-fixed px-2 py-0.5 text-[11px] font-semibold text-on-secondary-fixed-variant"
    title={`Deleted by the user ${dateTime(at)}`}
  >
    <EyeOff size={12} aria-hidden="true" />
    Deleted by user · {timeAgo(at)}
  </span>
)

/** When it happened, and how many times within a minute when it repeated. */
const WhenCell: React.FC<{ entry: ActivityEntry }> = ({ entry }) => (
  <>
    <time dateTime={entry.createdAt} className="block whitespace-nowrap text-[12px] text-on-surface">
      {dateTime(entry.createdAt)}
    </time>
    <p className="text-[11px] text-outline">
      {timeAgo(entry.createdAt)}
      {entry.count > 1 && (
        <span title={`Last at ${dateTime(entry.lastAt)}`}>
          {" "}
          · {entry.count} times
        </span>
      )}
    </p>
  </>
)

const WhatCell: React.FC<{ entry: ActivityEntry }> = ({ entry }) => (
  <>
    <p className="text-[13px] font-semibold text-on-surface">{entry.summary}</p>
    {entry.path && (
      <p className="mt-0.5 font-code text-[11px] text-on-surface-variant [overflow-wrap:anywhere]">
        {entry.method} {entry.path}
      </p>
    )}
  </>
)

const DeviceCell: React.FC<{ entry: ActivityEntry }> = ({ entry }) => (
  <>
    <p className="text-[12px] text-on-surface">{deviceLabel(entry)}</p>
    <p className="text-[11px] text-outline">{[entry.device, entry.ipAddress].filter(Boolean).join(" · ") || "No address"}</p>
  </>
)

export const ActivityLogView: React.FC<Props> = (props) => {
  const isAdmin = props.mode === "admin"
  const endpoint = props.mode === "admin" ? adminActivitiesEndpoint(props.userId) : ACTIVITY_LOGS_ENDPOINT

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const [search, setSearch] = useState("")
  const [module, setModule] = useState("")
  const [action, setAction] = useState("")
  const [outcome, setOutcome] = useState("")
  const [state, setState] = useState("")
  const [fromDay, setFromDay] = useState("")
  const [toDay, setToDay] = useState("")
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<ActivityPage | AdminActivityPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [answered, setAnswered] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  // What a confirmation is about to delete: the picked rows, one row, or everything the filters cover
  const [confirming, setConfirming] = useState<{ ids: string[] } | { all: true } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // Rows the person just deleted, gone from the page before the server has answered
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null)

  const settledSearch = useDebouncedValue(search.trim(), HISTORY_DEBOUNCE_MS)
  const badDateRange = isBackwardsRange(fromDay, toDay)
  const hasFilters = Boolean(search || module || action || outcome || state || fromDay || toDay)

  // The filters are kept on the account, so the list opens the way it was left (hooks/useSavedFilters)
  useSavedFilters({
    view: SAVED_VIEW[props.mode].view,
    filters: filtersOf(isAdmin ? { search, module, action, outcome, state, from: fromDay, to: toDay } : { search, module, action, outcome, from: fromDay, to: toDay }),
    apply: (saved: SavedFilters) => {
      setSearch(savedText(saved.search))
      // A module is only known from the records, so it is kept as it was saved, like a folder
      setModule(savedText(saved.module))
      setAction(oneOf(saved.action, ACTIVITY_ACTION_IDS))
      setOutcome(oneOf(saved.outcome, ACTIVITY_OUTCOME_IDS))
      setState(isAdmin ? oneOf(saved.state, ACTIVITY_STATE_IDS) : "")
      setFromDay(savedDay(saved.from))
      setToDay(savedDay(saved.to))
      setPage(1)
    },
  })

  // The filters as a query string, shared by the list and by "delete all matching"
  const filterParams = new URLSearchParams()
  if (search.trim() && settledSearch) filterParams.set("search", settledSearch)
  if (module) filterParams.set("module", module)
  if (action) filterParams.set("action", action)
  if (outcome) filterParams.set("outcome", outcome)
  if (isAdmin && state) filterParams.set("state", state)
  appendDayRange(filterParams, fromDay, toDay)
  const filterQuery = filterParams.toString()
  const query = `page=${page}${filterQuery ? `&${filterQuery}` : ""}`
  const requestKey = `${query}#${attempt}`
  const isLoading = !badDateRange && answered !== requestKey

  useEffect(() => {
    if (badDateRange) return
    // A newer request replaces the one on its way, so a slow answer never overwrites a newer one
    const controller = new AbortController()
    requestApi<ActivityPage | AdminActivityPage>(`${endpoint}?${query}`, { signal: controller.signal })
      .then(({ data }) => {
        setResult(data)
        setError(null)
        setHidden(new Set())
        if (data.page !== page) setPage(data.page)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : ACTIVITY_MESSAGES.listFailed)
      })
      .finally(() => {
        if (!controller.signal.aborted) setAnswered(requestKey)
      })
    return () => controller.abort()
  }, [endpoint, query, requestKey, page, badDateRange])

  const items = (result?.items ?? []).filter((entry) => !hidden.has(entry.id))
  const selection = useRowSelection(items.map((entry) => entry.id))
  const adminPage = isAdmin && result && "user" in result ? result : null
  const reload = () => setAttempt((count) => count + 1)

  const onFilterChange = (apply: () => void) => {
    apply()
    setPage(1)
    selection.clear()
  }

  const clear = () =>
    onFilterChange(() => {
      setSearch("")
      setModule("")
      setAction("")
      setOutcome("")
      setState("")
      setFromDay("")
      setToDay("")
    })

  const remove = async (target: { ids: string[] } | { all: true }) => {
    setIsDeleting(true)
    try {
      const { data, message } = await requestApi<ActivityDeletion>(`${endpoint}${filterQuery ? `?${filterQuery}` : ""}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target),
      })
      setNotice({ tone: "info", text: message ?? `${data.deleted} deleted.` })
      setConfirming(null)
      selection.clear()
      setPage(1)
      reload()
    } catch (reason: unknown) {
      setNotice({ tone: "error", text: reason instanceof Error ? reason.message : ACTIVITY_MESSAGES.deleteFailed })
    } finally {
      setIsDeleting(false)
    }
  }

  /**
   * One row's delete. The person's own is a soft delete, so it goes at once with no confirmation and
   * comes back if the server refuses; an admin's is permanent, so it confirms first.
   */
  const deleteOne = async (entry: ActivityEntry) => {
    if (isAdmin) {
      setConfirming({ ids: [entry.id] })
      return
    }
    setHidden((current) => new Set(current).add(entry.id))
    try {
      await requestApi<ActivityDeletion>(`${ACTIVITY_LOGS_ENDPOINT}/${entry.id}`, { method: "DELETE" })
      reload()
    } catch (reason: unknown) {
      setHidden((current) => {
        const next = new Set(current)
        next.delete(entry.id)
        return next
      })
      setNotice({ tone: "error", text: reason instanceof Error ? reason.message : ACTIVITY_MESSAGES.deleteFailed })
    }
  }

  const confirmCount = confirming ? ("ids" in confirming ? confirming.ids.length : (result?.total ?? 0)) : 0
  const allPicked = items.length > 0 && items.every((entry) => selection.isPicked(entry.id))

  const deleteButton = (entry: ActivityEntry) => (
    <button
      type="button"
      onClick={() => void deleteOne(entry)}
      disabled={isDeleting}
      aria-label={isAdmin ? `Delete this activity permanently: ${entry.summary}` : `Delete this activity: ${entry.summary}`}
      title={isAdmin ? "Delete permanently" : "Delete from your list"}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant transition-colors hover:border-error/40 hover:bg-error-container hover:text-error disabled:opacity-50"
    >
      <Trash2 size={15} aria-hidden="true" />
    </button>
  )

  const pickBox = (entry: ActivityEntry) => (
    <input
      type="checkbox"
      checked={selection.isPicked(entry.id)}
      disabled={isDeleting}
      onChange={(event) => selection.pick(entry.id, (event.nativeEvent as MouseEvent).shiftKey)}
      aria-label={`Pick ${entry.summary}`}
      className="h-4 w-4 shrink-0 accent-primary"
    />
  )

  // The admin's "deleted by the user" sits under the outcome, so the table needs no column of its own for it
  const headings = ["When", "Activity", "Module", isAdmin ? "Outcome and status" : "Outcome", "Device", "Actions"]

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 md:p-6 lg:min-h-full lg:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                {isAdmin && (
                  <Link href={USERS_HREF} className="mb-2 inline-flex min-h-6 items-center gap-1 text-[12px] font-semibold text-primary hover:underline">
                    <ArrowLeft size={14} aria-hidden="true" />
                    User Management
                  </Link>
                )}
                <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                  <ListChecks size={24} className="shrink-0 text-primary" aria-hidden="true" />
                  {isAdmin ? "User Activities" : "Activity Logs"}
                </h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {isAdmin ? (
                    adminPage ? (
                      <>
                        Every action of <span className="font-semibold text-on-surface">{adminPage.user.name || adminPage.user.email}</span> ({adminPage.user.email}), including
                        what they deleted from their own list. {ACTIVITY_MESSAGES.adminDeleteNote}
                      </>
                    ) : (
                      "Every action this account has taken, including what it deleted from its own list."
                    )
                  ) : (
                    <>Everything your account has done, newest first. {ACTIVITY_MESSAGES.hiddenNote}</>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={reload}
                disabled={isLoading}
                className="inline-flex shrink-0 items-center gap-1.5 self-start whitespace-nowrap rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
              >
                <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} aria-hidden="true" />
                Refresh
              </button>
            </div>

            {notice && (
              <p
                role={notice.tone === "error" ? "alert" : "status"}
                className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[13px] ${notice.tone === "error" ? "bg-error-container text-error" : "bg-primary-fixed/50 text-on-surface"}`}
              >
                {notice.tone === "error" ? <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />}
                {notice.text}
              </p>
            )}

            {isAdmin && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard icon={ListChecks} label="Activities recorded" value={adminPage?.summary.total ?? null} />
                <StatCard icon={EyeOff} label="Deleted by the user" value={adminPage?.summary.deleted ?? null} />
                <StatCard icon={Ban} label="Refused" value={adminPage?.summary.refused ?? null} tone="error" />
                <div className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-on-primary-fixed-variant">
                    <RefreshCw size={20} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-on-surface-variant">Last activity</p>
                    <p className="text-lg font-bold leading-tight text-on-surface">{adminPage ? timeAgo(adminPage.summary.lastAt) : "…"}</p>
                  </div>
                </div>
              </div>
            )}

            <FilterPanel
              columnsClassName={
                isAdmin
                  ? "lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_repeat(2,minmax(0,0.9fr))]"
                  : "lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_repeat(2,minmax(0,0.9fr))]"
              }
              canClear={hasFilters}
              onClear={clear}
              summary={
                badDateRange
                  ? HISTORY_MESSAGES.badDateRange
                  : result
                    ? `Showing ${items.length.toLocaleString()} of ${result.total.toLocaleString()} ${result.total === 1 ? "activity" : "activities"}, newest first`
                    : "Loading the activities..."
              }
            >
              <SearchFilter value={search} onChange={(value) => onFilterChange(() => setSearch(value))} placeholder="What was done, the tool, the address or the browser" />
              <SearchableSelectFilter
                label="Module"
                allLabel="Every module"
                value={module}
                options={result?.modules ?? []}
                onChange={(value) => onFilterChange(() => setModule(value))}
                searchPlaceholder="Search the modules"
                emptyLabel="No module matches"
              />
              <SelectFilter label="Action" allLabel="Any action" value={action} options={ACTIVITY_ACTIONS} onChange={(value) => onFilterChange(() => setAction(value))} />
              <SelectFilter label="Outcome" allLabel="Any outcome" value={outcome} options={ACTIVITY_OUTCOMES} onChange={(value) => onFilterChange(() => setOutcome(value))} />
              {isAdmin && <SelectFilter label="Status" allLabel="Everything" value={state} options={ACTIVITY_STATES} onChange={(value) => onFilterChange(() => setState(value))} />}
              <DateRangeFilters
                fromLabel="From"
                toLabel="To"
                fromDay={fromDay}
                toDay={toDay}
                onFromChange={(day) => onFilterChange(() => setFromDay(day))}
                onToChange={(day) => onFilterChange(() => setToDay(day))}
              />
            </FilterPanel>

            {result && (
              <BulkDeleteBar
                pickedCount={selection.pickedIds.size}
                total={result.total}
                noun={NOUN}
                hasFilters={hasFilters}
                isBusy={isDeleting}
                onDeletePicked={() => setConfirming({ ids: [...selection.pickedIds] })}
                onDeleteAll={() => setConfirming({ all: true })}
                onClear={selection.clear}
              />
            )}

            {error && !result ? (
              <div role="alert" className="flex flex-col items-center gap-3 py-16 short:py-5 text-center">
                <AlertTriangle size={20} className="text-error" aria-hidden="true" />
                <p className="max-w-sm text-sm text-on-surface-variant">{error}</p>
                <button type="button" onClick={reload} className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-semibold">
                  <RefreshCw size={15} aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : !result ? (
              <div role="status" className="flex items-center justify-center gap-2 py-16 short:py-5 text-sm text-on-surface-variant">
                <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" />
                Loading the activities...
              </div>
            ) : items.length === 0 ? (
              <p className="py-16 short:py-5 text-center text-sm text-on-surface-variant">
                {hasFilters ? "No activities match these filters." : isAdmin ? "This account has no activities yet." : "Nothing recorded yet. Your actions appear here as you work."}
              </p>
            ) : (
              <div className={`flex flex-col gap-3 transition-opacity ${isLoading ? "opacity-60" : ""}`} aria-busy={isLoading}>
                {/* The table from xl, where its 900px fits beside the open sidebar; cards below */}
                <div className="hidden overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm xl:block">
                  <table className="w-full min-w-[900px] border-collapse text-left">
                    <caption className="sr-only">Activities, newest first</caption>
                    <thead>
                      <tr className="border-b border-outline-variant">
                        <th scope="col" className="w-10 px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={allPicked}
                            disabled={isDeleting}
                            onChange={() => (allPicked ? selection.clear() : selection.pickAll())}
                            aria-label="Pick every activity on this page"
                            className="h-4 w-4 accent-primary"
                          />
                        </th>
                        {headings.map((heading) => (
                          <th key={heading} scope="col" className={`whitespace-nowrap px-3 py-2.5 ${historyLabelClass}`}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((entry) => (
                        <tr key={entry.id} className={`border-b border-outline-variant/60 last:border-b-0 ${entry.deletedAt ? "bg-surface-container-low/70" : ""}`}>
                          <td className="px-3 py-2.5 align-top">{pickBox(entry)}</td>
                          <td className="w-[170px] px-3 py-2.5 align-top">
                            <WhenCell entry={entry} />
                          </td>
                          <td className="min-w-[240px] px-3 py-2.5 align-top">
                            <WhatCell entry={entry} />
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <span className="inline-block whitespace-nowrap rounded-full bg-primary-fixed px-2 py-0.5 text-[11px] font-semibold text-on-primary-fixed-variant">{entry.moduleTitle}</span>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <span className="flex flex-col items-start gap-1">
                              <OutcomeBadge entry={entry} />
                              {isAdmin && entry.deletedAt && <DeletedBadge at={entry.deletedAt} />}
                            </span>
                          </td>
                          <td className="w-[190px] px-3 py-2.5 align-top">
                            <DeviceCell entry={entry} />
                          </td>
                          <td className="px-3 py-2.5 text-right align-top">{deleteButton(entry)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:hidden">
                  {items.map((entry) => (
                    <li
                      key={entry.id}
                      className={`flex min-w-0 flex-col gap-2 rounded-2xl border border-outline-variant p-3 shadow-sm ${entry.deletedAt ? "bg-surface-container-low" : "bg-surface-container-lowest"}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="pt-0.5">{pickBox(entry)}</span>
                        <div className="min-w-0 flex-1">
                          <WhatCell entry={entry} />
                        </div>
                        {deleteButton(entry)}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-[11px] font-semibold text-on-primary-fixed-variant">{entry.moduleTitle}</span>
                        <OutcomeBadge entry={entry} />
                        {entry.deletedAt && <DeletedBadge at={entry.deletedAt} />}
                      </div>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <WhenCell entry={entry} />
                        </div>
                        <div className="min-w-0 text-right">
                          <DeviceCell entry={entry} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {result.totalPages > 1 && <Pagination page={result.page} totalPages={result.totalPages} onPageChange={setPage} isLoading={isLoading} label="Activity pages" />}
              </div>
            )}
          </div>
        </main>
      </div>

      {confirming && (
        <ConfirmBulkDelete
          count={confirmCount}
          noun={NOUN}
          isDeleting={isDeleting}
          onConfirm={() => void remove(confirming)}
          onClose={() => setConfirming(null)}
          {...(isAdmin
            ? { description: "This cannot be undone. The activities are removed from the database for good." }
            : {
                description: "They leave your list.",
                message: `${confirmCount === 1 ? "This activity is" : `These ${confirmCount} activities are`} removed from your list. The administrators still see them.`,
              })}
        />
      )}
    </div>
  )
}
