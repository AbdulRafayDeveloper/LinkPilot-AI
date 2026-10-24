"use client"

import React from "react"
import { Search, X } from "lucide-react"
import {
  PROJECT_FILTER_MESSAGES,
  PROJECT_PRIORITIES,
  ROADMAP_STAGES,
  projectItemKind,
  type ProjectItemKind,
} from "@/constants/clientProjectTasks"
import { hasProjectFilters, projectFiltersFor, type ProjectFilterValues } from "@/lib/projectFilters"

interface ProjectFiltersProps {
  // Which tab is open, which decides what the bar offers
  kind: ProjectItemKind
  values: ProjectFilterValues
  onChange: (values: ProjectFilterValues) => void
  // How many of that tab's items are left, so the bar says what it is hiding
  shown: number
  total: number
  /**
   * Filters to leave out whatever the tab says. The shared link passes "shared": a client only ever
   * receives the notes that were shared with them, so narrowing to them would do nothing at all.
   */
  omit?: readonly (keyof ProjectFilterValues)[]
}

const selectClass =
  "h-9 rounded-xl border border-outline-variant bg-white px-2.5 text-[12px] font-semibold text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"

/**
 * Narrowing one tab down to what is being looked for, on both surfaces.
 *
 * **The bar offers what the tab really carries** (`projectFiltersFor`): the state only where items
 * are ticked off, the sign-off only where work is signed, the stage on the roadmap, who can see it
 * on the notes. Everything is a plain `<select>` beside a search box, the controls this module
 * already uses, so there is nothing new to learn on a thirteenth tab.
 *
 * It holds no state of its own: the page owns the values, which is what lets the owner's page keep
 * them on the account (`FILTER_VIEWS`) while a shared link keeps nothing at all.
 */
export const ProjectFilters: React.FC<ProjectFiltersProps> = ({ kind, values, onChange, shown, total, omit = [] }) => {
  const forTab = projectFiltersFor(kind)
  const offered = { ...forTab, ...Object.fromEntries(omit.map((name) => [name, false])) }
  const words = projectItemKind(kind)
  const isOn = hasProjectFilters(values)
  const set = (part: Partial<ProjectFilterValues>) => onChange({ ...values, ...part })

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-outline-variant bg-white px-3 py-2">
      <label className="flex h-9 min-w-[12rem] flex-1 items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
        <Search size={14} className="shrink-0 text-outline" aria-hidden="true" />
        <input
          value={values.search}
          onChange={(event) => set({ search: event.target.value })}
          placeholder={`${PROJECT_FILTER_MESSAGES.search}: ${words.label.toLowerCase()}`}
          aria-label={`${PROJECT_FILTER_MESSAGES.search}. ${PROJECT_FILTER_MESSAGES.searchHint}`}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-on-surface placeholder:text-outline focus:outline-none"
        />
      </label>

      <select
        value={values.priority}
        onChange={(event) => set({ priority: event.target.value })}
        aria-label={PROJECT_FILTER_MESSAGES.priority}
        className={selectClass}
      >
        <option value="">{PROJECT_FILTER_MESSAGES.allPriorities}</option>
        {PROJECT_PRIORITIES.map((priority) => (
          <option key={priority.id} value={priority.id}>
            {priority.label}
          </option>
        ))}
      </select>

      {offered.status && (
        <select value={values.status} onChange={(event) => set({ status: event.target.value })} aria-label={PROJECT_FILTER_MESSAGES.status} className={selectClass}>
          <option value="">{PROJECT_FILTER_MESSAGES.allStatuses}</option>
          <option value="open">{PROJECT_FILTER_MESSAGES.open}</option>
          <option value="done">{PROJECT_FILTER_MESSAGES.done}</option>
        </select>
      )}

      {offered.signed && (
        <select value={values.signed} onChange={(event) => set({ signed: event.target.value })} aria-label={PROJECT_FILTER_MESSAGES.signed} className={selectClass}>
          <option value="">{PROJECT_FILTER_MESSAGES.allSignings}</option>
          <option value="signed">{PROJECT_FILTER_MESSAGES.isSigned}</option>
          <option value="unsigned">{PROJECT_FILTER_MESSAGES.isNotSigned}</option>
        </select>
      )}

      {offered.stage && (
        <select value={values.stage} onChange={(event) => set({ stage: event.target.value })} aria-label={PROJECT_FILTER_MESSAGES.stage} className={selectClass}>
          <option value="">{PROJECT_FILTER_MESSAGES.allStages}</option>
          {ROADMAP_STAGES.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.label}
            </option>
          ))}
        </select>
      )}

      {offered.shared && (
        <select value={values.shared} onChange={(event) => set({ shared: event.target.value })} aria-label={PROJECT_FILTER_MESSAGES.shared} className={selectClass}>
          <option value="">{PROJECT_FILTER_MESSAGES.allSharing}</option>
          <option value="shared">{PROJECT_FILTER_MESSAGES.isShared}</option>
          <option value="internal">{PROJECT_FILTER_MESSAGES.isInternal}</option>
        </select>
      )}

      {/* What is being hidden, and the way out of it, only while something is on */}
      {isOn && (
        <>
          <span className="text-[12px] text-on-surface-variant">{PROJECT_FILTER_MESSAGES.matching(shown, total)}</span>
          <button
            type="button"
            onClick={() => onChange({ search: "", priority: "", status: "", signed: "", stage: "", shared: "" })}
            className="inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-xl px-2.5 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            <X size={13} aria-hidden="true" />
            {PROJECT_FILTER_MESSAGES.clear}
          </button>
        </>
      )}
    </div>
  )
}
