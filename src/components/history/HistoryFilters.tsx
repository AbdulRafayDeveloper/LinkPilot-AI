"use client"

import React, { useEffect, useId, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"
import { HISTORY_SEARCH_MAX_LENGTH } from "@/constants/historyFilters"
import { filterByWords } from "@/lib/nameSearch"

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

/** A choice that can be searched by something other than what it reads, such as a name without its count. */
export interface SearchableOption {
  id: string
  label: string
  // What typing is matched against; the label when there is none
  searchText?: string
}

interface SearchableSelectFilterProps {
  label: string
  allLabel: string
  value: string
  options: readonly SearchableOption[]
  onChange: (value: string) => void
  searchPlaceholder: string
  // What to say when nothing matches what was typed
  emptyLabel: string
}

/**
 * The same choice filter as `SelectFilter`, for a list long enough to search: it reads as one field,
 * and opening it gives a box to type in and the choices narrowing as you type, with the arrow keys,
 * Enter and Escape. It takes and gives back exactly what `SelectFilter` does, an option's id or ""
 * for all of them, so a filter can be swapped over without anything around it changing.
 */
export const SearchableSelectFilter: React.FC<SearchableSelectFilterProps> = ({
  label,
  allLabel,
  value,
  options,
  onChange,
  searchPlaceholder,
  emptyLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const labelId = useId()

  // "All" is a choice like any other, so it can be moved to with the keyboard and searched for
  const all: SearchableOption = useMemo(() => ({ id: "", label: allLabel }), [allLabel])
  const shown = useMemo(
    () => filterByWords([all, ...options], query, (option) => option.searchText ?? option.label),
    [all, options, query]
  )
  const selected = options.find((option) => option.id === value)

  const close = () => {
    setIsOpen(false)
    setQuery("")
  }

  const pick = (id: string) => {
    onChange(id)
    close()
    buttonRef.current?.focus()
  }

  useEffect(() => {
    if (isOpen) searchRef.current?.focus()
  }, [isOpen])

  // A click anywhere else closes it, the way every other dropdown in the app behaves
  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) close()
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [isOpen])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault()
      close()
      buttonRef.current?.focus()
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (shown.length === 0) return
      const step = event.key === "ArrowDown" ? 1 : -1
      setActiveIndex((current) => (current + step + shown.length) % shown.length)
    } else if (event.key === "Enter") {
      event.preventDefault()
      const option = shown[activeIndex]
      if (option) pick(option.id)
    } else if (event.key === "Tab") {
      close()
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className={historyLabelClass}>
        {label}
      </span>
      <div ref={wrapperRef} className="relative">
        <button
          ref={buttonRef}
          type="button"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-haspopup="listbox"
          aria-labelledby={labelId}
          onClick={() => (isOpen ? close() : setIsOpen(true))}
          onKeyDown={(event) => {
            if (!isOpen && (event.key === "ArrowDown" || event.key === "Enter")) {
              event.preventDefault()
              setIsOpen(true)
            }
          }}
          className={`${fieldClass} flex items-center justify-between gap-2 text-left`}
        >
          <span className={`min-w-0 flex-1 truncate ${selected ? "text-on-surface" : "text-on-surface-variant"}`}>
            {selected?.label ?? allLabel}
          </span>
          <ChevronDown size={14} className={`shrink-0 text-outline transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>

        {isOpen && (
          <div
            onKeyDown={onKeyDown}
            className="absolute left-0 right-0 top-full z-20 mt-1 flex min-w-[220px] flex-col gap-1 rounded-xl border border-outline-variant bg-white p-2 shadow-lg"
          >
            <span className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-outline" aria-hidden="true" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  // Typing narrows the list, so the choice the keyboard is on goes back to the top of it
                  setActiveIndex(0)
                }}
                maxLength={HISTORY_SEARCH_MAX_LENGTH}
                aria-label={searchPlaceholder}
                aria-controls={listId}
                placeholder={searchPlaceholder}
                className={`${fieldClass} pl-8`}
              />
            </span>
            <ul id={listId} role="listbox" aria-labelledby={labelId} className="custom-scrollbar max-h-56 overflow-y-auto">
              {shown.map((option, index) => {
                const isSelected = option.id === value
                return (
                  <li key={option.id || "all"} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => pick(option.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
                        index === activeIndex ? "bg-surface-container-high text-on-surface" : "text-on-surface"
                      } ${isSelected ? "font-semibold" : ""}`}
                    >
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {isSelected && <Check size={14} className="shrink-0 text-primary" aria-hidden="true" />}
                    </button>
                  </li>
                )
              })}
            </ul>
            {shown.length === 0 && (
              <p role="status" className="px-2.5 py-2 text-[13px] text-on-surface-variant">
                {emptyLabel}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

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
