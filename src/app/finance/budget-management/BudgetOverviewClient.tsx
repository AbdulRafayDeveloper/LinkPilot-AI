"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { CalendarPlus, ChevronRight, FileDown, Loader2, Printer, Settings } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useBudgetLedger } from "@/hooks/useBudgetLedger"
import { useSavedFilters } from "@/hooks/useSavedFilters"
import { filtersOf, savedText, type SavedFilters } from "@/lib/savedFilters"
import { requestApi } from "@/lib/apiClient"
import {
  breakdownsOf,
  buildLedger,
  entriesCsv,
  ledgerCsv,
  monthLabel,
  monthOfDate,
  participantIdsOf,
  shiftMonth,
  totalsOf,
} from "@/lib/budget"
import { BUDGET_MESSAGES, BUDGET_SETTINGS_ENDPOINT, BUDGET_TOOL, budgetMonthHref } from "@/constants/budget"
import type { BudgetMonthSummary, BudgetSettings } from "@/types/budget"
import { Breakdown, Money, StatCard, downloadText } from "@/components/budget/BudgetParts"
import { BudgetSettingsDialog } from "@/components/budget/BudgetSettingsDialog"

const buttonClass =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"

const StatusChip: React.FC<{ summary: BudgetMonthSummary }> = ({ summary }) =>
  !summary.isRecorded ? (
    <span className="whitespace-nowrap rounded-full border border-outline-variant px-2 py-0.5 text-[10.5px] font-bold text-on-surface-variant">Not started</span>
  ) : summary.confirmedAt ? (
    <span className="whitespace-nowrap rounded-full bg-success-container px-2 py-0.5 text-[10.5px] font-bold text-on-success-container">Confirmed</span>
  ) : (
    <span className="whitespace-nowrap rounded-full bg-secondary-fixed px-2 py-0.5 text-[10.5px] font-bold text-on-secondary-fixed-variant">Needs review</span>
  )

/**
 * Budget Management's report: the whole business at a glance (what came in, what went out, what each
 * person received, what was reinvested and the balance now), every month with its previous and new
 * balance, and where the money came from and went. A month opens on its own page to be edited.
 */
export default function BudgetOverviewClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const { ledger, setLedger, error, reload } = useBudgetLedger()
  const [year, setYear] = useState("")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const Icon = BUDGET_TOOL.icon

  useSavedFilters({ view: "budget-overview", filters: filtersOf({ year }), apply: (saved: SavedFilters) => setYear(savedText(saved.year)) })

  const currentMonth = monthOfDate(new Date())
  const summaries = useMemo(() => (ledger ? buildLedger(ledger.months, ledger.settings, currentMonth) : []), [ledger, currentMonth])
  const years = useMemo(() => [...new Set(summaries.map((summary) => summary.month.slice(0, 4)))].sort().reverse(), [summaries])
  // A year that no longer has a month reads as every year, so a kept filter can never empty the page
  const shownYear = years.includes(year) ? year : ""
  const shown = shownYear ? summaries.filter((summary) => summary.month.startsWith(shownYear)) : summaries
  const shownMonths = useMemo(() => (ledger ? (shownYear ? ledger.months.filter((month) => month.month.startsWith(shownYear)) : ledger.months) : []), [ledger, shownYear])
  const settings = ledger?.settings
  const currency = settings?.baseCurrency ?? "PKR"
  const totals = totalsOf(shown, settings?.openingBalance ?? 0)
  const breakdowns = useMemo(() => breakdownsOf(shownMonths, currency), [shownMonths, currency])
  const participantIds = settings ? participantIdsOf(shown, settings.participants) : []
  const nameOf = (id: string) => settings?.participants.find((participant) => participant.id === id)?.name ?? "Removed participant"
  const lastRecorded = ledger?.months[ledger.months.length - 1]?.month
  const nextMonth = lastRecorded && lastRecorded >= currentMonth ? shiftMonth(lastRecorded, 1) : currentMonth
  const toReview = summaries.filter((summary) => summary.isRecorded && !summary.confirmedAt)

  const saveSettings = async (next: BudgetSettings) => {
    setIsSavingSettings(true)
    setSettingsError(null)
    try {
      const { data } = await requestApi<BudgetSettings>(BUDGET_SETTINGS_ENDPOINT, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) })
      setLedger((current) => (current ? { ...current, settings: data } : current))
      setIsSettingsOpen(false)
      setNotice(BUDGET_MESSAGES.settingsSaved)
    } catch (reason: unknown) {
      setSettingsError(reason instanceof Error ? reason.message : BUDGET_MESSAGES.settingsFailed)
    } finally {
      setIsSavingSettings(false)
    }
  }

  const fileSuffix = shownYear || "all-time"

  return (
    <div data-print-page className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6 lg:min-h-full lg:p-8">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                  <Icon size={24} className="shrink-0 text-primary" aria-hidden="true" />
                  {BUDGET_TOOL.title}
                </h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Add what came in and what went out each month. Every total, each person&apos;s distribution, what is reinvested and the balance are worked out for you.
                </p>
              </div>
              <div data-print-hide className="flex flex-wrap gap-2">
                <Link href={budgetMonthHref(nextMonth)} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-hover">
                  <CalendarPlus size={16} aria-hidden="true" /> {monthLabel(nextMonth)}
                </Link>
                <button type="button" onClick={() => setIsSettingsOpen(true)} disabled={!ledger} className={buttonClass}>
                  <Settings size={16} aria-hidden="true" /> Settings
                </button>
                <button type="button" onClick={() => window.print()} disabled={!ledger} className={buttonClass}>
                  <Printer size={16} aria-hidden="true" /> PDF
                </button>
                <button type="button" onClick={() => ledger && downloadText(`budget-summary-${fileSuffix}.csv`, ledgerCsv(shown, ledger.settings))} disabled={!ledger} className={buttonClass}>
                  <FileDown size={16} aria-hidden="true" /> Summary CSV
                </button>
                <button type="button" onClick={() => ledger && downloadText(`budget-entries-${fileSuffix}.csv`, entriesCsv(shownMonths, currency))} disabled={!ledger} className={buttonClass}>
                  <FileDown size={16} aria-hidden="true" /> All entries CSV
                </button>
              </div>
            </div>

            {notice && (
              <p className="rounded-xl border border-success/30 bg-success-container/50 px-4 py-2 text-sm text-on-success-container" role="status">
                {notice}
              </p>
            )}
            {error && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-error/30 bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">
                {error}
                <button type="button" onClick={reload} className="font-semibold underline">
                  Try again
                </button>
              </div>
            )}
            {!ledger && !error && (
              <p className="flex items-center gap-2 text-sm text-on-surface-variant">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Loading your budget...
              </p>
            )}

            {ledger && settings && (
              <>
                <div className="flex flex-wrap items-center gap-3" data-print-hide>
                  <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                    Showing
                    <select value={shownYear} onChange={(event) => setYear(event.target.value)} className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-sm text-on-surface">
                      <option value="">All time</option>
                      {years.map((entry) => (
                        <option key={entry} value={entry}>
                          {entry}
                        </option>
                      ))}
                    </select>
                  </label>
                  {toReview.length > 0 && (
                    <p className="text-[12px] text-on-secondary-fixed-variant">
                      {toReview.length} {toReview.length === 1 ? "month needs" : "months need"} its distribution reviewed:{" "}
                      {toReview.map((summary, index) => (
                        <React.Fragment key={summary.month}>
                          {index > 0 && ", "}
                          <Link href={budgetMonthHref(summary.month)} className="font-semibold underline">
                            {monthLabel(summary.month, "short")}
                          </Link>
                        </React.Fragment>
                      ))}
                    </p>
                  )}
                </div>
                <p className="hidden text-sm print:block">{shownYear ? `Year ${shownYear}` : "All time"} · amounts in {currency}</p>

                <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
                  <StatCard label="Came in" amount={totals.earning} currency={currency} hint={`${totals.months} ${totals.months === 1 ? "month" : "months"} recorded`} />
                  <StatCard label="Went out" amount={totals.expense} currency={currency} />
                  <StatCard label="Distributed" amount={totals.distributed} currency={currency} hint={`Fixed ${Math.round(totals.fixed).toLocaleString("en-US")} · additional ${Math.round(totals.additional).toLocaleString("en-US")}`} />
                  <StatCard label="Reinvested" amount={totals.reinvested} currency={currency} tone={totals.reinvested < 0 ? "error" : "success"} />
                  <StatCard label="Balance now" amount={totals.balance} currency={currency} tone="primary" hint={shownYear ? `At the end of ${shownYear}` : "In the business today"} />
                </section>

                {participantIds.length > 0 && (
                  <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    {participantIds.map((id) => (
                      <StatCard key={id} label={`${nameOf(id)} received`} amount={totals.perParticipant[id] ?? 0} currency={currency} />
                    ))}
                  </section>
                )}

                <section className="flex flex-col gap-2">
                  <h2 className="text-lg font-bold text-on-surface">Month by month</h2>
                  {shown.every((summary) => !summary.isRecorded) && <p className="text-sm text-on-surface-variant">{BUDGET_MESSAGES.noData}</p>}
                  {/* A table where it fits, cards below it */}
                  <div className="hidden overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest xl:block print:block">
                    <table className="w-full min-w-[900px] text-left text-[13px]">
                      <thead className="bg-surface-container-low text-[11px] uppercase tracking-wider text-on-surface-variant">
                        <tr>
                          {["Month", "Came in", "Went out", "Profit", "Distributed", "Reinvested", "Balance before", "Balance after", "Status"].map((heading) => (
                            <th key={heading} className="px-3 py-2.5 font-bold">
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...shown].reverse().map((summary) => (
                          <tr key={summary.month} className="border-t border-outline-variant/70 hover:bg-surface-container-low">
                            <td className="px-3 py-2.5 font-semibold">
                              <Link href={budgetMonthHref(summary.month)} className="inline-flex items-center gap-1 text-on-surface hover:text-primary">
                                {monthLabel(summary.month)} <ChevronRight size={13} className="text-outline print:hidden" aria-hidden="true" />
                              </Link>
                            </td>
                            <td className="px-3 py-2.5"><Money amount={summary.earning} currency={currency} /></td>
                            <td className="px-3 py-2.5"><Money amount={summary.expense} currency={currency} /></td>
                            <td className="px-3 py-2.5"><Money amount={summary.profit} currency={currency} tone="auto" /></td>
                            <td className="px-3 py-2.5">
                              <Money amount={summary.distributed} currency={currency} />
                              {summary.distributed > 0 && (
                                <span className="block text-[11px] text-on-surface-variant">
                                  {Object.entries(summary.transfers)
                                    .filter(([, amount]) => amount > 0)
                                    .map(([id, amount]) => `${nameOf(id)} ${Math.round(amount).toLocaleString("en-US")}`)
                                    .join(" · ")}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5"><Money amount={summary.reinvested} currency={currency} tone="auto" /></td>
                            <td className="px-3 py-2.5"><Money amount={summary.previousBalance} currency={currency} tone="auto" /></td>
                            <td className="px-3 py-2.5 font-semibold"><Money amount={summary.newBalance} currency={currency} tone="auto" /></td>
                            <td className="px-3 py-2.5"><StatusChip summary={summary} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:hidden print:hidden">
                    {[...shown].reverse().map((summary) => (
                      <li key={summary.month}>
                        <Link href={budgetMonthHref(summary.month)} className="block rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 hover:bg-surface-container-low">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-on-surface">{monthLabel(summary.month)}</span>
                            <StatusChip summary={summary} />
                          </div>
                          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                            {(
                              [
                                ["Came in", summary.earning],
                                ["Went out", summary.expense],
                                ["Profit", summary.profit],
                                ["Distributed", summary.distributed],
                                ["Reinvested", summary.reinvested],
                                ["Balance after", summary.newBalance],
                              ] as const
                            ).map(([label, amount]) => (
                              <div key={label} className="min-w-0">
                                <dt className="text-on-surface-variant">{label}</dt>
                                <dd className="font-semibold"><Money amount={amount} currency={currency} tone="auto" /></dd>
                              </div>
                            ))}
                          </dl>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="flex flex-col gap-2">
                  <h2 className="text-lg font-bold text-on-surface">Where it came from and where it went</h2>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    <Breakdown title="By client" rows={breakdowns.clients} currency={currency} />
                    <Breakdown title="By project" rows={breakdowns.projects} currency={currency} />
                    <Breakdown title="How clients were found" rows={breakdowns.sources} currency={currency} />
                    <Breakdown title="How payments arrived" rows={breakdowns.methods} currency={currency} />
                    <Breakdown title="Received through" rows={breakdowns.through} currency={currency} />
                    <Breakdown title="Expenses by category" rows={breakdowns.categories} currency={currency} />
                    <Breakdown title="Largest expenses" rows={breakdowns.expenses} currency={currency} />
                  </div>
                </section>
              </>
            )}
          </div>
        </main>
      </div>

      {isSettingsOpen && ledger && (
        <BudgetSettingsDialog
          settings={ledger.settings}
          months={ledger.months}
          isSaving={isSavingSettings}
          error={settingsError}
          onSave={(next) => void saveSettings(next)}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  )
}
