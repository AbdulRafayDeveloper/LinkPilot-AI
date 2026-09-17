"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Activity, AlertTriangle, Loader2, LogIn, RefreshCw, ScrollText, ShieldAlert, Users } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { DateRangeFilters, FilterPanel, SearchFilter, SelectFilter, historyLabelClass } from "@/components/history/HistoryFilters"
import { LoadMore } from "@/components/history/LoadMore"
import { DeviceLine, EventBadge, StatCard, dateTime } from "@/components/admin/AdminParts"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { useCursorList } from "@/hooks/useCursorList"
import { appendDayRange, isBackwardsRange } from "@/lib/dayRange"
import { HISTORY_DEBOUNCE_MS, HISTORY_MESSAGES } from "@/constants/historyFilters"
import { ACTIVE_DAYS, ADMIN_ENDPOINTS, ADMIN_MESSAGES, AUDIT_HREF, LOGIN_EVENTS, USERS_HREF } from "@/constants/admin"
import type { AuditPage, LoginEventEntry } from "@/types/admin"

const idOf = (entry: LoginEventEntry) => entry.id

/**
 * Audit Management: every sign-in, sign-up, sign-out and refused attempt, newest first, with who,
 * when, the device and browser, and the address. Filters run on the server and cover the whole
 * log; `?user=<id>` (from User Management) narrows it to one account.
 */
export default function AuditClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const userId = useSearchParams().get("user") ?? ""
  const [search, setSearch] = useState("")
  const [event, setEvent] = useState("")
  const [fromDay, setFromDay] = useState("")
  const [toDay, setToDay] = useState("")
  const settledSearch = useDebouncedValue(search.trim(), HISTORY_DEBOUNCE_MS)
  const badDateRange = isBackwardsRange(fromDay, toDay)
  const hasFilters = Boolean(search || event || fromDay || toDay)

  const params = new URLSearchParams()
  if (search.trim() && settledSearch) params.set("search", settledSearch)
  if (event) params.set("event", event)
  if (/^[0-9a-f]{24}$/.test(userId)) params.set("userId", userId)
  appendDayRange(params, fromDay, toDay)

  const list = useCursorList<LoginEventEntry, AuditPage>({
    endpoint: ADMIN_ENDPOINTS.audit,
    query: params.toString(),
    enabled: !badDateRange,
    loadFailed: ADMIN_MESSAGES.auditLoadFailed,
    idOf,
  })
  // The summary covers the whole log whatever the filters, and comes with every first batch
  const summary = list.latest?.summary ?? null

  const clear = () => {
    setSearch("")
    setEvent("")
    setFromDay("")
    setToDay("")
  }

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 md:p-6 lg:p-8">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                <ScrollText size={24} className="shrink-0 text-primary" aria-hidden="true" />
                Audit Management
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                Every sign-in, sign-up, sign-out and refused attempt, newest first. Admins only.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={LogIn} label="Sign-ins, last 24 hours" value={summary?.signIns24h ?? null} tone="success" />
              <StatCard icon={ShieldAlert} label="Refused, last 24 hours" value={summary?.failed24h ?? null} hint="Wrong passwords and lockouts" tone="error" />
              <StatCard icon={Users} label={`Active accounts, ${ACTIVE_DAYS} days`} value={summary?.activeUsers7d ?? null} />
              <StatCard icon={Activity} label="Events recorded" value={summary?.totalEvents ?? null} />
            </div>

            {userId && (
              <p className="flex flex-wrap items-center gap-2 rounded-xl bg-primary-fixed/50 px-3 py-2 text-[13px] text-on-surface">
                Showing one account&apos;s events.
                <Link href={AUDIT_HREF} className="font-semibold text-primary hover:underline">
                  Show everyone
                </Link>
                <Link href={USERS_HREF} className="font-semibold text-primary hover:underline">
                  Back to User Management
                </Link>
              </p>
            )}

            <FilterPanel
              columnsClassName="lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_repeat(2,minmax(0,0.9fr))]"
              canClear={hasFilters}
              onClear={clear}
              summary={
                badDateRange
                  ? HISTORY_MESSAGES.badDateRange
                  : list.hasAnswer
                    ? `Showing ${list.items.length.toLocaleString()} of ${list.total.toLocaleString()} ${list.total === 1 ? "event" : "events"}, newest first`
                    : "Loading the audit log..."
              }
            >
              <SearchFilter value={search} onChange={setSearch} placeholder="Name, email, address, browser or system" />
              <SelectFilter label="Event" allLabel="All events" value={event} options={LOGIN_EVENTS} onChange={setEvent} />
              <DateRangeFilters fromLabel="From" toLabel="To" fromDay={fromDay} toDay={toDay} onFromChange={setFromDay} onToChange={setToDay} />
            </FilterPanel>

            {list.error && !list.hasAnswer ? (
              <div role="alert" className="flex flex-col items-center gap-3 py-16 text-center">
                <AlertTriangle size={20} className="text-error" aria-hidden="true" />
                <p className="max-w-sm text-sm text-on-surface-variant">{list.error}</p>
                <button type="button" onClick={list.retry} className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-semibold">
                  <RefreshCw size={15} aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : !list.hasAnswer ? (
              <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
                <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" />
                Loading the audit log...
              </div>
            ) : list.items.length === 0 ? (
              <p className="py-16 text-center text-sm text-on-surface-variant">{hasFilters ? "No events match these filters." : "Nothing recorded yet."}</p>
            ) : (
              <div className={`flex flex-col gap-3 transition-opacity ${list.isLoading ? "opacity-60" : ""}`} aria-busy={list.isLoading}>
                <div className="hidden overflow-x-auto rounded-2xl border border-outline-variant bg-white shadow-sm md:block">
                  <table className="w-full min-w-[880px] border-collapse text-left">
                    <caption className="sr-only">Sign-in activity, newest first</caption>
                    <thead className="bg-surface-container-lowest">
                      <tr className="border-b border-outline-variant">
                        {["When", "Account", "Event", "Device and browser", "Address"].map((heading) => (
                          <th key={heading} scope="col" className={`px-3 py-2.5 ${historyLabelClass}`}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {list.items.map((entry) => (
                        <tr key={entry.id} className="border-b border-outline-variant/60 last:border-b-0 hover:bg-surface-container-lowest">
                          <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-on-surface">
                            <time dateTime={entry.createdAt}>{dateTime(entry.createdAt)}</time>
                          </td>
                          <td className="max-w-[280px] px-3 py-2.5">
                            <p className="truncate text-[13px] font-semibold text-on-surface">{entry.name ?? "No such account"}</p>
                            <p className="truncate text-[12px] text-on-surface-variant">{entry.email}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <EventBadge event={entry.event} />
                            {entry.performedBy && <p className="mt-0.5 truncate text-[11px] text-outline">by {entry.performedBy}</p>}
                          </td>
                          <td className="max-w-[260px] px-3 py-2.5">
                            <DeviceLine device={entry} />
                            <p className="text-[11px] text-outline">{entry.device}</p>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 font-code text-[12px] text-on-surface-variant">{entry.ipAddress ?? "Unknown"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="flex flex-col gap-2 md:hidden">
                  {list.items.map((entry) => (
                    <li key={entry.id} className="flex flex-col gap-1.5 rounded-2xl border border-outline-variant bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-on-surface">{entry.name ?? "No such account"}</p>
                          <p className="truncate text-[12px] text-on-surface-variant">{entry.email}</p>
                        </div>
                        <EventBadge event={entry.event} />
                      </div>
                      {entry.performedBy && <p className="text-[11px] text-outline">by {entry.performedBy}</p>}
                      <DeviceLine device={entry} />
                      <p className="text-[11px] text-outline">
                        <time dateTime={entry.createdAt}>{dateTime(entry.createdAt)}</time>
                        {entry.ipAddress ? ` · ${entry.ipAddress}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>

                <LoadMore hasMore={list.hasMore} isLoadingMore={list.isLoadingMore} error={list.moreError} onLoadMore={list.loadMore} doneText="That is the whole log." />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
