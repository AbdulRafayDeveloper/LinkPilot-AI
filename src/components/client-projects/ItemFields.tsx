"use client"

import React from "react"
import {
  DEFAULT_ESTIMATE_UNIT,
  ESTIMATE_MAX_VALUE,
  ESTIMATE_UNITS,
  PROJECT_TASK_MESSAGES,
  type EstimateUnit,
} from "@/constants/clientProjectTasks"
import { estimateLabel } from "@/lib/projectItems"
import type { ProjectEstimate } from "@/types/clientProjectTasks"

/**
 * What an item on a client project carries beside its words: **how long it is expected to take**,
 * on the backlog.
 *
 * **How urgent it is** is the shared picker (`components/ui/PriorityPicker`), since Daily Tasks
 * ranks its work with the same three words; it is re-exported here so every caller in this module
 * reads exactly as it did.
 */

export { PriorityChip, PrioritySelect } from "@/components/ui/PriorityPicker"

/** How long a backlog item is expected to take, as a tag. Nothing at all when nobody has said. */
export const EstimateChip: React.FC<{ estimate: ProjectEstimate | null }> = ({ estimate }) => {
  const words = estimateLabel(estimate)
  if (!words) return null
  return (
    <span className="inline-flex items-center rounded-full bg-primary-fixed px-2 py-0.5 text-[10px] font-semibold text-on-primary-fixed-variant" title={PROJECT_TASK_MESSAGES.estimate}>
      {words}
    </span>
  )
}

interface EstimateFieldProps {
  estimate: ProjectEstimate | null
  onChange: (estimate: ProjectEstimate | null) => void
  disabled?: boolean
  idPrefix: string
}

/**
 * How long it is expected to take: a number and the unit it is counted in, which is as easy to
 * write as "2 days" and still adds up. Emptying the number clears it, so there is no second
 * control for "actually, I don't know".
 */
export const EstimateField: React.FC<EstimateFieldProps> = ({ estimate, onChange, disabled, idPrefix }) => {
  const unit: EstimateUnit = estimate?.unit ?? DEFAULT_ESTIMATE_UNIT
  return (
    <div>
      <label htmlFor={`${idPrefix}-estimate`} className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-outline">
        {PROJECT_TASK_MESSAGES.estimate} <span className="normal-case tracking-normal">(optional)</span>
      </label>
      <div className="flex items-center gap-2">
        <input
          id={`${idPrefix}-estimate`}
          type="number"
          inputMode="decimal"
          min={0}
          max={ESTIMATE_MAX_VALUE}
          step="any"
          value={estimate?.value ?? ""}
          onChange={(event) => {
            const value = Number(event.target.value)
            onChange(event.target.value === "" || !Number.isFinite(value) || value <= 0 ? null : { value, unit })
          }}
          disabled={disabled}
          placeholder="2"
          className="h-10 w-24 rounded-xl border border-outline-variant bg-white px-3 text-[13px] text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
        />
        <select
          value={unit}
          onChange={(event) => onChange(estimate?.value ? { value: estimate.value, unit: event.target.value as EstimateUnit } : null)}
          disabled={disabled}
          aria-label="The unit the time is counted in"
          className="h-10 rounded-xl border border-outline-variant bg-white px-3 text-[13px] text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
        >
          {ESTIMATE_UNITS.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1 text-[11px] text-outline">{PROJECT_TASK_MESSAGES.estimateHint}</p>
    </div>
  )
}
