"use client"

import React, { useState } from "react"
import { CheckCircle2, CircleSlash } from "lucide-react"
import { FilterPanel, SearchFilter, SelectFilter } from "@/components/history/HistoryFilters"
import { ModelMapTable } from "@/components/admin/ModelMapTable"
import { useSavedFilters } from "@/hooks/useSavedFilters"
import { filtersOf, isFiltering, oneOf, savedText } from "@/lib/savedFilters"
import { distinctChoices, filterModelMap, MODEL_MAP_SHOW, type ModelMapFilters } from "@/lib/modelPageFilters"
import { MODEL_PRIORITY_MESSAGES } from "@/constants/modelPriority"
import type { ModelPriorityOverview } from "@/types/modelPriority"

const NO_FILTERS: ModelMapFilters = { search: "", module: "", job: "", provider: "", show: "" }

/**
 * AI Model Priority → Models in use: which providers this deployment has set up, then which model
 * does each job in each module and what takes over, narrowed by a search, the module, the job, the
 * provider that does it by default and what to look for (nothing can do it, no fallback, admins'
 * own order), kept on the account.
 */
export const ModelMapView: React.FC<{ overview: ModelPriorityOverview }> = ({ overview }) => {
  const [filters, setFilters] = useState<ModelMapFilters>(NO_FILTERS)
  const set = (patch: Partial<ModelMapFilters>) => setFilters((current) => ({ ...current, ...patch }))
  const rows = overview.modelMap.rows

  useSavedFilters({
    view: "admin-model-map",
    filters: filtersOf(filters),
    apply: (kept) =>
      setFilters({
        search: savedText(kept.search),
        module: savedText(kept.module),
        job: savedText(kept.job),
        provider: savedText(kept.provider),
        show: oneOf(kept.show, MODEL_MAP_SHOW.map((choice) => choice.id)),
      }),
  })

  const shown = filterModelMap(rows, filters)
  const modules = distinctChoices(rows, (row) => row.module, (row) => row.title)
  const jobs = distinctChoices(
    rows.filter((row) => !filters.module || row.module === filters.module),
    (row) => row.job,
    (row) => row.job
  )
  const providers = distinctChoices(
    rows.flatMap((row) => row.chain.slice(0, 1)),
    (step) => step.provider,
    (step) => step.label
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" aria-label="Models on this deployment">
        {overview.providers.map((provider) => (
          <span
            key={provider.id}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold ${
              provider.configured ? "border-success/40 bg-success-container/40 text-on-success-container" : "border-outline-variant bg-surface-container-lowest text-outline"
            }`}
          >
            {provider.configured ? <CheckCircle2 size={13} aria-hidden="true" /> : <CircleSlash size={13} aria-hidden="true" />}
            {provider.label}: {provider.configured ? "configured" : "not configured"}
          </span>
        ))}
      </div>

      <FilterPanel
        columnsClassName="md:grid-cols-3 xl:grid-cols-5"
        summary={`${shown.length} of ${rows.length} jobs`}
        canClear={isFiltering(filtersOf(filters))}
        onClear={() => setFilters(NO_FILTERS)}
      >
        <SearchFilter value={filters.search} onChange={(search) => set({ search })} placeholder="Module or model" />
        <SelectFilter
          label="Module"
          allLabel="All modules"
          value={filters.module}
          options={modules}
          // A job belongs to its module, so changing module drops a job the new one does not have
          onChange={(module) => set({ module, job: rows.some((row) => row.module === module && row.job === filters.job) ? filters.job : "" })}
        />
        <SelectFilter label="Job" allLabel="All jobs" value={filters.job} options={jobs} onChange={(job) => set({ job })} />
        <SelectFilter label="Default provider" allLabel="Any provider" value={filters.provider} options={providers} onChange={(provider) => set({ provider })} />
        <SelectFilter label="Show" allLabel="Every job" value={filters.show} options={MODEL_MAP_SHOW} onChange={(show) => set({ show })} />
      </FilterPanel>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-3 py-6 text-center text-[13px] text-on-surface-variant">
          {MODEL_PRIORITY_MESSAGES.nothingMatches}
        </p>
      ) : (
        <ModelMapTable map={{ ...overview.modelMap, rows: shown }} />
      )}
    </div>
  )
}
