"use client"

import React, { useEffect, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { DateRangeFilters, FilterPanel, SelectFilter } from "@/components/history/HistoryFilters"
import { requestApi } from "@/lib/apiClient"
import { appendDayRange, isBackwardsRange } from "@/lib/dayRange"
import { dayIn, displayTimeZone } from "@/lib/timeZone"
import { shiftDate } from "@/lib/taskDates"
import { formatCost } from "@/lib/aiCost"
import { filtersOf, isFiltering, oneOf, savedDay, savedText } from "@/lib/savedFilters"
import { useSavedFilters } from "@/hooks/useSavedFilters"
import {
  AI_COST_MESSAGES,
  AI_COSTS_ENDPOINT,
  AI_USAGE_KINDS,
  COST_PERIOD_IDS,
  COST_PERIODS,
  DEFAULT_COST_PERIOD,
  type CostPeriodId,
} from "@/constants/aiCosts"
import type { CostReport, CostTotals } from "@/types/aiCosts"

interface Filters {
  period: CostPeriodId
  from: string
  to: string
  provider: string
  model: string
  module: string
  kind: string
}

const NO_FILTERS: Filters = { period: DEFAULT_COST_PERIOD, from: "", to: "", provider: "", model: "", module: "", kind: "" }

const count = (value: number) => Math.round(value).toLocaleString()
const minutes = (seconds: number) => (seconds > 0 ? `${(Math.round(seconds / 6) / 10).toLocaleString()} min` : "0")

/** The days a period covers, worked out from today in the viewer's own timezone. */
function daysOf(filters: Filters): { from: string; to: string } {
  if (filters.period === "custom") return { from: filters.from, to: filters.to }
  const today = dayIn(displayTimeZone())
  if (filters.period === "month") return { from: `${today.slice(0, 8)}01`, to: today }
  const days = COST_PERIODS.find((period) => period.id === filters.period)?.days
  return days ? { from: shiftDate(today, 1 - days), to: today } : { from: "", to: "" }
}

/** A share of the largest, as a thin bar beside the exact figure, which is always in text too. */
const Bar: React.FC<{ value: number; max: number; label: string }> = ({ value, max, label }) => (
  <span className="block h-2 w-full overflow-hidden rounded-full bg-surface-container-high" title={label}>
    <span className="block h-full rounded-full bg-primary" style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%` }} />
  </span>
)

const Stat: React.FC<{ label: string; value: string; detail?: string; strong?: boolean }> = ({ label, value, detail, strong }) => (
  <div className="rounded-xl border border-outline-variant bg-white p-3">
    <p className="text-[10px] font-bold uppercase tracking-wider text-outline">{label}</p>
    <p className={`mt-1 font-bold text-on-surface ${strong ? "text-2xl text-primary" : "text-lg"}`}>{value}</p>
    {detail && <p className="text-[11px] text-on-surface-variant">{detail}</p>}
  </div>
)

/** One breakdown (module, kind or day) as named bars, largest first, each with its cost and calls. */
const Breakdown: React.FC<{ title: string; rows: { key: string; label: string; totals: CostTotals }[]; scroll?: boolean }> = ({ title, rows, scroll }) => {
  const max = Math.max(0, ...rows.map((row) => row.totals.cost))
  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-xl border border-outline-variant bg-white p-3">
      <h3 className="text-[13px] font-bold text-on-surface">{title}</h3>
      <ul className={`flex flex-col gap-2 ${scroll ? "custom-scrollbar max-h-72 overflow-y-auto pr-1" : ""}`}>
        {rows.map((row) => (
          <li key={row.key} className="flex flex-col gap-1">
            <span className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className="min-w-0 truncate text-on-surface" title={row.label}>
                {row.label}
              </span>
              <span className="shrink-0 font-semibold text-on-surface">
                {formatCost(row.totals.cost)} <span className="font-normal text-outline">· {count(row.totals.calls)} calls</span>
              </span>
            </span>
            <Bar value={row.totals.cost} max={max} label={`${row.label}: ${formatCost(row.totals.cost)}`} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * AI Model Priority → Usage & cost: the filters (period, provider, model, module and kind, kept on
 * the account), the totals, then what each model, provider, module, kind and day used and cost. A
 * provider or model the app starts using offers itself in the filters with no change here.
 */
export const AiCostView: React.FC<{ onSetPrices: () => void }> = ({ onSetPrices }) => {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [report, setReport] = useState<CostReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The query the report on screen answers, so a newer one shows as loading until it lands
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const set = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, ...patch }))

  useSavedFilters({
    view: "admin-ai-costs",
    filters: filtersOf(filters),
    apply: (kept) =>
      setFilters({
        period: oneOf<CostPeriodId>(kept.period, COST_PERIOD_IDS) || DEFAULT_COST_PERIOD,
        from: savedDay(kept.from),
        to: savedDay(kept.to),
        provider: savedText(kept.provider),
        model: savedText(kept.model),
        module: savedText(kept.module),
        kind: oneOf(kept.kind, AI_USAGE_KINDS),
      }),
  })

  const range = daysOf(filters)
  const isBackwards = isBackwardsRange(range.from, range.to)
  const params = appendDayRange(new URLSearchParams(), range.from, range.to)
  for (const key of ["provider", "model", "module", "kind"] as const) if (filters[key]) params.set(key, filters[key])
  params.set("tz", displayTimeZone())
  const query = params.toString()
  const isLoading = loadedFor !== query

  useEffect(() => {
    if (isBackwards) return
    const controller = new AbortController()
    requestApi<CostReport>(`${AI_COSTS_ENDPOINT}?${query}`, { signal: controller.signal })
      .then(({ data }) => {
        setReport(data)
        setLoadedFor(query)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : AI_COST_MESSAGES.loadFailed)
      })
    return () => controller.abort()
  }, [query, isBackwards])

  const options = report?.options
  const models = (options?.models ?? []).filter((entry) => !filters.provider || entry.provider === filters.provider)
  const totals = report?.totals
  const maxModelCost = Math.max(0, ...(report?.byModel ?? []).map((row) => row.cost))

  return (
    <div className="flex flex-col gap-3">
      <FilterPanel
        columnsClassName="md:grid-cols-3 xl:grid-cols-7"
        summary={
          isBackwards ? (
            <span className="text-error">{AI_COST_MESSAGES.badDates}</span>
          ) : totals ? (
            `${count(totals.calls)} calls · ${formatCost(totals.cost)}`
          ) : (
            ""
          )
        }
        canClear={isFiltering(filtersOf({ ...filters, period: filters.period === DEFAULT_COST_PERIOD ? "" : filters.period }))}
        onClear={() => setFilters(NO_FILTERS)}
      >
        <SelectFilter
          label="Period"
          allLabel={COST_PERIODS[0].label}
          value={filters.period === "all" ? "" : filters.period}
          options={COST_PERIODS.slice(1)}
          onChange={(value) => {
            const period = (value || "all") as CostPeriodId
            // Choosing dates starts from what the period on screen covered
            set(period === "custom" ? { period, ...daysOf(filters) } : { period })
          }}
        />
        <DateRangeFilters
          fromLabel="From"
          toLabel="To"
          fromDay={range.from}
          toDay={range.to}
          onFromChange={(day) => set({ period: "custom", from: day, to: range.to })}
          onToChange={(day) => set({ period: "custom", from: range.from, to: day })}
        />
        <SelectFilter
          label="Provider"
          allLabel="All providers"
          value={filters.provider}
          options={options?.providers ?? []}
          onChange={(provider) =>
            set({ provider, model: provider && !models.some((entry) => entry.provider === provider && entry.model === filters.model) ? "" : filters.model })
          }
        />
        <SelectFilter
          label="Model"
          allLabel="All models"
          value={filters.model}
          options={models.map((entry) => ({ id: entry.model, label: filters.provider ? entry.model : `${entry.model} (${entry.provider})` }))}
          onChange={(model) => set({ model })}
        />
        <SelectFilter label="Module" allLabel="All modules" value={filters.module} options={options?.modules ?? []} onChange={(module) => set({ module })} />
        <SelectFilter label="Kind" allLabel="All kinds" value={filters.kind} options={options?.kinds ?? []} onChange={(kind) => set({ kind })} />
      </FilterPanel>

      {error ? (
        <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[13px] text-error">
          {error}
        </p>
      ) : !report || !totals ? (
        <p role="status" className="flex items-center gap-2 text-[13px] text-on-surface-variant">
          <Loader2 size={15} className="animate-spin text-primary" aria-hidden="true" />
          Loading costs...
        </p>
      ) : (
        <div className={`flex flex-col gap-3 transition-opacity ${isLoading ? "opacity-60" : ""}`} aria-busy={isLoading}>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Stat label="Total cost" value={formatCost(totals.cost)} strong />
            <Stat label="Calls" value={count(totals.calls)} />
            <Stat label="Tokens" value={count(totals.inputTokens + totals.outputTokens)} detail={`${count(totals.inputTokens)} in · ${count(totals.outputTokens)} out`} />
            <Stat label="Speech" value={minutes(totals.audioSeconds)} />
          </div>

          {(totals.estimatedCost > 0 || totals.unpricedCalls > 0) && (
            <div className="flex flex-wrap items-start gap-2 rounded-xl bg-secondary-fixed px-3 py-2 text-[12px] text-on-secondary-fixed-variant">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="min-w-0 flex-1">
                {totals.estimatedCost > 0 && `${AI_COST_MESSAGES.estimated(formatCost(totals.estimatedCost))} `}
                {totals.unpricedCalls > 0 && AI_COST_MESSAGES.unpriced(totals.unpricedCalls)}
              </p>
              {totals.unpricedCalls > 0 && (
                <button type="button" onClick={onSetPrices} className="shrink-0 rounded-md bg-white px-2 py-1 font-semibold text-on-surface hover:text-primary">
                  {AI_COST_MESSAGES.setPrices}
                </button>
              )}
            </div>
          )}

          {report.byModel.length === 0 ? (
            <p className="rounded-xl border border-dashed border-outline-variant px-3 py-6 text-center text-[13px] text-on-surface-variant">{AI_COST_MESSAGES.nothingUsed}</p>
          ) : (
            <>
              <section aria-label="Cost by model" className="flex flex-col gap-2">
                <h3 className="text-[13px] font-bold text-on-surface">By model</h3>
                {/* Cards on a phone, the table from md, where its columns fit the popup */}
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:hidden">
                  {report.byModel.map((row) => (
                    <li key={`${row.provider}-${row.model}`} className="flex flex-col gap-1 rounded-xl border border-outline-variant bg-white p-3 text-[12px]">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 break-all font-mono text-on-surface">{row.model}</span>
                        <span className="shrink-0 text-[14px] font-bold text-on-surface">{formatCost(row.cost)}</span>
                      </span>
                      <span className="text-on-surface-variant">
                        {row.providerLabel} · {count(row.calls)} calls · {count(row.inputTokens)} in · {count(row.outputTokens)} out
                        {row.audioSeconds > 0 && ` · ${minutes(row.audioSeconds)}`}
                      </span>
                      <Bar value={row.cost} max={maxModelCost} label={`${row.model}: ${formatCost(row.cost)}`} />
                      {!row.hasPrice && <span className="text-[11px] font-semibold text-on-secondary-fixed-variant">{AI_COST_MESSAGES.noPrice}</span>}
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-x-auto rounded-xl border border-outline-variant bg-white md:block">
                  <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
                    <thead className="bg-surface-container-lowest text-[11px] uppercase tracking-wide text-outline">
                      <tr>
                        {["Model", "Provider", "Calls", "Input tokens", "Output tokens", "Speech", "Cost", "Share"].map((heading) => (
                          <th key={heading} scope="col" className="px-3 py-2 font-semibold">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.byModel.map((row) => (
                        <tr key={`${row.provider}-${row.model}`} className="border-t border-outline-variant/70">
                          <th scope="row" className="max-w-[260px] px-3 py-2 font-mono font-semibold text-on-surface [overflow-wrap:anywhere]">
                            {row.model}
                            {!row.hasPrice && (
                              <span className="ml-2 whitespace-nowrap rounded-full bg-secondary-fixed px-2 py-0.5 font-sans text-[10px] font-semibold text-on-secondary-fixed-variant">
                                {AI_COST_MESSAGES.noPrice}
                              </span>
                            )}
                          </th>
                          <td className="px-3 py-2">{row.providerLabel}</td>
                          <td className="px-3 py-2">{count(row.calls)}</td>
                          <td className="px-3 py-2">{count(row.inputTokens)}</td>
                          <td className="px-3 py-2">{count(row.outputTokens)}</td>
                          <td className="px-3 py-2">{minutes(row.audioSeconds)}</td>
                          <td className="px-3 py-2 font-bold text-on-surface">{formatCost(row.cost)}</td>
                          <td className="w-32 px-3 py-2">
                            <Bar value={row.cost} max={maxModelCost} label={`${row.model}: ${formatCost(row.cost)}`} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section aria-label="Cost by provider" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {report.byProvider.map((row) => (
                  <Stat
                    key={row.provider}
                    label={row.providerLabel}
                    value={formatCost(row.cost)}
                    detail={`${count(row.calls)} calls · ${count(row.inputTokens + row.outputTokens)} tokens${row.audioSeconds > 0 ? ` · ${minutes(row.audioSeconds)}` : ""}`}
                  />
                ))}
              </section>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <Breakdown title="By module" rows={report.byModule.map((row) => ({ key: row.module, label: row.title, totals: row }))} scroll />
                <Breakdown title="By kind" rows={report.byKind.map((row) => ({ key: row.kind, label: row.label, totals: row }))} />
                <Breakdown title="By day" rows={report.byDay.map((row) => ({ key: row.day, label: row.day, totals: row }))} scroll />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
