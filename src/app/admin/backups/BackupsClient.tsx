"use client"

import React, { useEffect, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, CircleX, CloudUpload, DatabaseBackup, Download, Loader2, RefreshCw } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { DateRangeFilters, FilterPanel, SearchFilter, SelectFilter, historyLabelClass } from "@/components/history/HistoryFilters"
import { Pagination } from "@/components/ui/Pagination"
import { StatCard, dateTime, timeAgo } from "@/components/admin/AdminParts"
import { formatBytes } from "@/components/important-files/AddAssetDialog"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { requestApi } from "@/lib/apiClient"
import { appendDayRange, isBackwardsRange } from "@/lib/dayRange"
import { HISTORY_DEBOUNCE_MS, HISTORY_MESSAGES } from "@/constants/historyFilters"
import {
  BACKUPS_ENDPOINT,
  BACKUP_EXPORT_ENDPOINT,
  BACKUP_MESSAGES,
  BACKUP_SCHEDULE_LABEL,
  BACKUP_STATUSES,
  BACKUP_TRIGGERS,
  backupTriggerLabel,
} from "@/constants/backups"
import type { BackupLogEntry, BackupsPage } from "@/types/backups"

/**
 * Database Backup: every backup run, newest first, 50 to a page, searched and filtered on the
 * server. The whole database is backed up once a week by itself (the schedule is in vercel.json,
 * which Vercel Cron reads), and from here an admin can take one now: **Download backup** writes the
 * database out as one JSON file to keep and puts a copy in the cloud, and **Back up to cloud**
 * runs exactly what the weekly schedule runs. Admins only, on the page and in the API.
 */

const STATUS_STYLE = {
  success: "bg-success-container text-on-success-container",
  failed: "bg-error-container text-error",
} as const

const StatusBadge: React.FC<{ entry: BackupLogEntry }> = ({ entry }) => (
  <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[entry.status]}`}>
    {entry.status === "success" ? <CheckCircle2 size={12} aria-hidden="true" /> : <CircleX size={12} aria-hidden="true" />}
    {entry.status === "success" ? "Succeeded" : "Failed"}
  </span>
)

/** How long a run took, in the largest unit that still says something useful. */
const howLong = (ms: number | null): string => {
  if (ms === null) return "—"
  if (ms < 1000) return `${ms} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  const minutes = Math.floor(ms / 60_000)
  return `${minutes} min ${Math.round((ms % 60_000) / 1000)} s`
}

/** What one backup holds, under its file name. */
const heldBy = (entry: BackupLogEntry): string => {
  const parts = [
    entry.sizeBytes === null ? null : formatBytes(entry.sizeBytes),
    entry.collections === null ? null : `${entry.collections.toLocaleString()} collections`,
    entry.documents === null ? null : `${entry.documents.toLocaleString()} documents`,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(" · ") : "Nothing was written"
}

export default function BackupsClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [trigger, setTrigger] = useState("")
  const [fromDay, setFromDay] = useState("")
  const [toDay, setToDay] = useState("")
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<BackupsPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [answered, setAnswered] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Which kind of run is on its way, so neither button is pressed twice
  const [running, setRunning] = useState<"export" | "cloud" | null>(null)
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const downloadRef = useRef<HTMLAnchorElement>(null)

  // Typing settles before the list is asked for again, and an emptied search box counts at once
  const settledSearch = useDebouncedValue(search.trim(), HISTORY_DEBOUNCE_MS)
  const badDateRange = isBackwardsRange(fromDay, toDay)
  const hasFilters = Boolean(search || status || trigger || fromDay || toDay)

  const params = new URLSearchParams({ page: String(page) })
  if (search.trim() && settledSearch) params.set("search", settledSearch)
  if (status) params.set("status", status)
  if (trigger) params.set("trigger", trigger)
  appendDayRange(params, fromDay, toDay)
  const query = params.toString()
  const requestKey = `${query}#${attempt}`
  const isLoading = !badDateRange && answered !== requestKey

  useEffect(() => {
    if (badDateRange) return
    // A newer request replaces the one on its way, so a slow answer never overwrites a newer one
    const controller = new AbortController()
    requestApi<BackupsPage>(`${BACKUPS_ENDPOINT}?${query}`, { signal: controller.signal })
      .then(({ data }) => {
        setResult(data)
        setError(null)
        // The server clamps a page past the end, and the pager follows it
        if (data.page !== page) setPage(data.page)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : BACKUP_MESSAGES.listFailed)
      })
      .finally(() => {
        if (!controller.signal.aborted) setAnswered(requestKey)
      })
    return () => controller.abort()
  }, [query, requestKey, page, badDateRange])

  const reload = () => setAttempt((count) => count + 1)
  const summary = result?.summary ?? null
  const items = result?.items ?? []

  const clear = () => {
    setSearch("")
    setStatus("")
    setTrigger("")
    setFromDay("")
    setToDay("")
    setPage(1)
  }

  const onFilterChange = (apply: () => void) => {
    apply()
    setPage(1)
  }

  /**
   * Downloads the whole database as one JSON file. The browser writes the stream straight to disk,
   * so a database of any size is saved without being held in memory; the record of the run appears
   * in the list once the file has finished, which Refresh picks up.
   */
  const downloadNow = () => {
    if (running) return
    setRunning("export")
    setNotice({ tone: "info", text: "Writing the database out. Your download starts as soon as the file is ready, and the record appears here once it has finished." })
    downloadRef.current?.click()
    // The browser owns the download from here, so the button frees itself rather than waiting on it
    window.setTimeout(() => setRunning(null), 4000)
  }

  /** Runs exactly what the weekly schedule runs: the dump straight to the bucket, and its record. */
  const backUpToCloud = async () => {
    if (running) return
    setRunning("cloud")
    setNotice({ tone: "info", text: "Backing the database up to the cloud. This takes as long as the database is large." })
    try {
      const { data } = await requestApi<BackupLogEntry>(BACKUPS_ENDPOINT, { method: "POST" }, { retry: false })
      setNotice({ tone: "info", text: `Backed up to the cloud as ${data.fileName} (${heldBy(data)}).` })
    } catch (reason: unknown) {
      setNotice({ tone: "error", text: reason instanceof Error ? reason.message : BACKUP_MESSAGES.runFailed })
    } finally {
      setRunning(null)
      setPage(1)
      reload()
    }
  }

  /** Opens one stored backup through a link signed for a few minutes, as every stored file works here. */
  const downloadStored = async (entry: BackupLogEntry) => {
    if (downloading) return
    setDownloading(entry.id)
    try {
      const { data } = await requestApi<{ url: string }>(`${BACKUPS_ENDPOINT}/${entry.id}/link`)
      window.open(data.url, "_blank", "noopener,noreferrer")
    } catch (reason: unknown) {
      setNotice({ tone: "error", text: reason instanceof Error ? reason.message : BACKUP_MESSAGES.linkFailed })
    } finally {
      setDownloading(null)
    }
  }

  const fileCell = (entry: BackupLogEntry) => (
    <>
      <p className="truncate font-code text-[12px] text-on-surface">{entry.fileName}</p>
      <p className="text-[11px] text-on-surface-variant">{heldBy(entry)}</p>
      {!entry.hasFile && entry.status === "success" && <p className="text-[11px] text-outline">Downloaded only, no cloud copy</p>}
    </>
  )

  const actionCell = (entry: BackupLogEntry) =>
    entry.hasFile ? (
      <button
        type="button"
        onClick={() => void downloadStored(entry)}
        disabled={downloading === entry.id}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-outline-variant bg-white px-2.5 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
      >
        {downloading === entry.id ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Download size={13} aria-hidden="true" />}
        Download
      </button>
    ) : (
      <span className="text-[11px] text-outline">No file</span>
    )

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 md:p-6 lg:p-8">
            {/* The title stacks above the buttons until xl, so a phone never wraps a button's label */}
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                  <DatabaseBackup size={24} className="shrink-0 text-primary" aria-hidden="true" />
                  Database Backup
                </h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                  The whole database is backed up <span className="font-semibold text-on-surface">{BACKUP_SCHEDULE_LABEL}</span> and kept in the app&apos;s
                  own cloud storage. Every run is recorded here, whether it worked or not. Admins only.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={reload}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
                >
                  <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} aria-hidden="true" />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => void backUpToCloud()}
                  disabled={running !== null}
                  title="Runs exactly what the weekly schedule runs"
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
                >
                  {running === "cloud" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <CloudUpload size={15} aria-hidden="true" />}
                  Back up to cloud
                </button>
                <button
                  type="button"
                  onClick={downloadNow}
                  disabled={running !== null}
                  title={BACKUP_MESSAGES.exportHint}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
                >
                  {running === "export" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}
                  Download backup
                </button>
                {/* The browser writes the stream to disk itself, so the file is never held in memory */}
                <a ref={downloadRef} href={BACKUP_EXPORT_ENDPOINT} download className="hidden" aria-hidden="true" tabIndex={-1}>
                  Download the database as JSON
                </a>
              </div>
            </div>

            {notice && (
              <p
                role={notice.tone === "error" ? "alert" : "status"}
                className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[13px] ${
                  notice.tone === "error" ? "bg-error-container text-error" : "bg-primary-fixed/50 text-on-surface"
                }`}
              >
                {notice.tone === "error" ? <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />}
                {notice.text}
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={DatabaseBackup} label="Backups recorded" value={summary?.total ?? null} />
              <StatCard icon={CheckCircle2} label="Succeeded" value={summary?.succeeded ?? null} tone="success" />
              <StatCard icon={CircleX} label="Failed" value={summary?.failed ?? null} tone="error" />
              <div className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-on-primary-fixed-variant">
                  <CloudUpload size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-on-surface-variant">Last successful backup</p>
                  <p className="text-lg font-bold leading-tight text-on-surface">{summary ? timeAgo(summary.lastSuccessAt) : "…"}</p>
                  {summary?.lastSuccessAt && (
                    <p className="truncate text-[11px] text-outline">
                      <time dateTime={summary.lastSuccessAt}>{dateTime(summary.lastSuccessAt)}</time>
                    </p>
                  )}
                </div>
              </div>
            </div>

            <FilterPanel
              columnsClassName="lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_repeat(2,minmax(0,0.9fr))]"
              canClear={hasFilters}
              onClear={clear}
              summary={
                badDateRange
                  ? HISTORY_MESSAGES.badDateRange
                  : result
                    ? `Showing ${items.length.toLocaleString()} of ${result.total.toLocaleString()} ${result.total === 1 ? "run" : "runs"}, newest first`
                    : "Loading the backups..."
              }
            >
              <SearchFilter value={search} onChange={(value) => onFilterChange(() => setSearch(value))} placeholder="File name, who ran it, or why it failed" />
              <SelectFilter label="Status" allLabel="All runs" value={status} options={BACKUP_STATUSES} onChange={(value) => onFilterChange(() => setStatus(value))} />
              <SelectFilter label="How it ran" allLabel="Any way" value={trigger} options={BACKUP_TRIGGERS} onChange={(value) => onFilterChange(() => setTrigger(value))} />
              <DateRangeFilters
                fromLabel="From"
                toLabel="To"
                fromDay={fromDay}
                toDay={toDay}
                onFromChange={(day) => onFilterChange(() => setFromDay(day))}
                onToChange={(day) => onFilterChange(() => setToDay(day))}
              />
            </FilterPanel>

            {error && !result ? (
              <div role="alert" className="flex flex-col items-center gap-3 py-16 short:py-5 text-center">
                <AlertTriangle size={20} className="text-error" aria-hidden="true" />
                <p className="max-w-sm text-sm text-on-surface-variant">{error}</p>
                <button type="button" onClick={reload} className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-semibold">
                  <RefreshCw size={15} aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : !result ? (
              <div role="status" className="flex items-center justify-center gap-2 py-16 short:py-5 text-sm text-on-surface-variant">
                <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" />
                Loading the backups...
              </div>
            ) : items.length === 0 ? (
              <p className="py-16 short:py-5 text-center text-sm text-on-surface-variant">
                {hasFilters ? "No backups match these filters." : `Nothing backed up yet. The first one runs ${BACKUP_SCHEDULE_LABEL.toLowerCase()}, or take one now.`}
              </p>
            ) : (
              <div className={`flex flex-col gap-3 transition-opacity ${isLoading ? "opacity-60" : ""}`} aria-busy={isLoading}>
                {/* The table from xl, where its 880px fits beside the open sidebar (936px there); cards below */}
                <div className="hidden overflow-x-auto rounded-2xl border border-outline-variant bg-white shadow-sm xl:block">
                  <table className="w-full min-w-[880px] border-collapse text-left [overflow-wrap:anywhere]">
                    <caption className="sr-only">Database backups, newest first</caption>
                    <thead className="bg-surface-container-lowest">
                      <tr className="border-b border-outline-variant">
                        {["When", "Status", "How it ran", "Backup file", "Took", "Actions"].map((heading) => (
                          <th key={heading} scope="col" className={`px-3 py-2.5 ${historyLabelClass}`}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((entry) => (
                        <tr key={entry.id} className="border-b border-outline-variant/60 last:border-b-0 hover:bg-surface-container-lowest">
                          <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-on-surface">
                            <time dateTime={entry.createdAt}>{dateTime(entry.createdAt)}</time>
                            <p className="text-[11px] text-outline">{timeAgo(entry.createdAt)}</p>
                          </td>
                          <td className="max-w-[230px] px-3 py-2.5">
                            <StatusBadge entry={entry} />
                            {entry.errorMessage && <p className="mt-1 text-[11px] text-error [overflow-wrap:anywhere]">{entry.errorMessage}</p>}
                          </td>
                          {/* A width, so the email's `truncate` has something to truncate against: without one
                              the cell grows to fit a long address and widens the whole table */}
                          <td className="max-w-[150px] px-3 py-2.5">
                            <p className="whitespace-nowrap text-[12px] text-on-surface">{backupTriggerLabel(entry.trigger)}</p>
                            <p className="truncate text-[11px] text-outline" title={entry.startedBy ?? "The schedule"}>
                              {entry.startedBy ?? "The schedule"}
                            </p>
                          </td>
                          <td className="max-w-[250px] px-3 py-2.5">{fileCell(entry)}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-on-surface-variant">{howLong(entry.durationMs)}</td>
                          <td className="px-3 py-2.5">{actionCell(entry)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:hidden">
                  {items.map((entry) => (
                    <li key={entry.id} className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-outline-variant bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">{fileCell(entry)}</div>
                        <StatusBadge entry={entry} />
                      </div>
                      {entry.errorMessage && <p className="text-[11px] text-error [overflow-wrap:anywhere]">{entry.errorMessage}</p>}
                      <p className="text-[11px] text-outline">
                        {backupTriggerLabel(entry.trigger)} · {entry.startedBy ?? "The schedule"} · took {howLong(entry.durationMs)}
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] text-outline">
                          <time dateTime={entry.createdAt}>{dateTime(entry.createdAt)}</time>
                        </p>
                        {actionCell(entry)}
                      </div>
                    </li>
                  ))}
                </ul>

                {result.totalPages > 1 && (
                  <Pagination page={result.page} totalPages={result.totalPages} onPageChange={setPage} isLoading={isLoading} label="Backup pages" />
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
