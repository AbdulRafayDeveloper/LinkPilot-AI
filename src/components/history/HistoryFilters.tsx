"use client"

import React from "react"
import { Search, X } from "lucide-react"
import { HISTORY_SEARCH_MAX_LENGTH } from "@/constants/historyFilters"

/**
 * The filter bar every "view all" page uses: a search box, choice lists and a date range in one
 * panel, a line saying what is showing, and Clear filters when anything is set.
 */

const fieldClass =
  "h-9 w-full rounded-lg border border-outline-variant bg-white px-2.5 text-[13px] text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
export const historyLabelClass = "text-[10px] font-bold uppercase tracking-wider text-outline"

interface FilterPanelProps {
  // Grid columns on a wide screen, since each page has a different number of filters
  columnsClassName: string
  summary: React.ReactNode
  canClear: boolean
  onClear: () => void
  children: React.ReactNode
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ columnsClassName, summary, canClear, onClear, children }) => (
  <section aria-label="Filters" className="rounded-2xl border border-outline-variant bg-white p-3 shadow-sm">
    <div className={`grid grid-cols-2 gap-3 ${columnsClassName}`}>{children}</div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-[12px] text-on-surface-variant" aria-live="polite">
        {summary}
      </p>
      {canClear && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-outline transition-colors hover:bg-surface-container hover:text-primary"
        >
          <X size={13} aria-hidden="true" />
          Clear filters
        </button>
      )}
    </div>
  </section>
)

export const SearchFilter: React.FC<{ value: string; onChange: (value: string) => void; placeholder: string }> = ({
  value,
  onChange,
  placeholder,
}) => (
  <label className="col-span-2 flex flex-col gap-1 lg:col-span-1">
    <span className={historyLabelClass}>Search</span>
    <span className="relative">
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-outline" aria-hidden="true" />
      <input
        type="search"
        value={value}
        maxLength={HISTORY_SEARCH_MAX_LENGTH}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`${fieldClass} pl-8`}
      />
    </span>
  </label>
)

interface SelectFilterProps {
  label: string
  allLabel: string
  value: string
  options: readonly { id: string; label: string }[]
  onChange: (value: string) => void
}

export const SelectFilter: React.FC<SelectFilterProps> = ({ label, allLabel, value, options, onChange }) => (
  <label className="flex flex-col gap-1">
    <span className={historyLabelClass}>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass}>
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
)

interface DateRangeFiltersProps {
  fromLabel: string
  toLabel: string
  fromDay: string
  toDay: string
  onFromChange: (day: string) => void
  onToChange: (day: string) => void
}

export const DateRangeFilters: React.FC<DateRangeFiltersProps> = ({ fromLabel, toLabel, fromDay, toDay, onFromChange, onToChange }) => (
  <>
    <label className="flex flex-col gap-1">
      <span className={historyLabelClass}>{fromLabel}</span>
      <input type="date" value={fromDay} max={toDay || undefined} onChange={(event) => onFromChange(event.target.value)} className={fieldClass} />
    </label>
    <label className="flex flex-col gap-1">
      <span className={historyLabelClass}>{toLabel}</span>
      <input type="date" value={toDay} min={fromDay || undefined} onChange={(event) => onToChange(event.target.value)} className={fieldClass} />
    </label>
  </>
)
