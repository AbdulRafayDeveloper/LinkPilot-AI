"use client"

import React from "react"
import {
  DEFAULT_ESTIMATE_UNIT,
  ESTIMATE_MAX_VALUE,
  ESTIMATE_UNITS,
  PROJECT_PRIORITIES,
  PROJECT_TASK_MESSAGES,
  projectPriority,
  type EstimateUnit,
  type ProjectPriority,
} from "@/constants/clientProjectTasks"
import { estimateLabel } from "@/lib/projectItems"
import type { ProjectEstimate } from "@/types/clientProjectTasks"

/**
 * The two things every item on a client project carries beside its words: **how urgent it is**, on
 * every tab, and **how long it is expected to take**, on the backlog.
 *
 * Both are the same pieces on the owner's page and behind a shared link, and both are a plain
 * `<select>` rather than a menu of our own: a chip that opens a list has to be placed, clamped and
 * closed on every scroll (see Meeting Planner's status menu), while a select is what every phone,
 * every keyboard and every screen reader already knows, which is what a list of 300 items wants.
 */

/** The colour each priority is shown in. The word is always there, so it never rests on colour. */
const PRIORITY_TONE: Record<ProjectPriority, string> = {
  high: "bg-error-container text-error",
  medium: "bg-secondary-fixed text-on-secondary-fixed-variant",
  low: "bg-surface-container-high text-outline",
}

/** How urgent an item is, as a tag. Read-only: the list's own control is the one below. */
export const PriorityChip: React.FC<{ priority: ProjectPriority; className?: string }> = ({ priority, className = "" }) => {
  const words = projectPriority(priority)
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${PRIORITY_TONE[words.id]} ${className}`}>
      {words.label}
    </span>
  )
}

interface PrioritySelectProps {
  value: ProjectPriority
  onChange: (priority: ProjectPriority) => void
  disabled?: boolean
  // What it is the priority of, for a screen reader, since the control itself carries no words
  label: string
  className?: string
}

/** How urgent an item is, changed where it is read: on the item itself, and in the composer. */
export const PrioritySelect: React.FC<PrioritySelectProps> = ({ value, onChange, disabled, label, className = "" }) => {
  const words = projectPriority(value)
  return (
    <select
      value={words.id}
      onChange={(event) => onChange(event.target.value as ProjectPriority)}
      disabled={disabled}
      aria-label={PROJECT_TASK_MESSAGES.priorityOf(label)}
      title={PROJECT_TASK_MESSAGES.priorityOf(label)}
      className={`h-7 cursor-pointer rounded-full border-0 px-2 text-[10px] font-bold uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60 ${PRIORITY_TONE[words.id]} ${className}`}
    >
      {PROJECT_PRIORITIES.map((priority) => (
        <option key={priority.id} value={priority.id}>
          {priority.label}
        </option>
      ))}
    </select>
  )
}

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
