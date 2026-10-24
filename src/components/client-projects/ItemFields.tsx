"use client"

import React from "react"
import { Check, CircleDashed, Eye, EyeOff, Loader2 } from "lucide-react"
import {
  DEFAULT_ESTIMATE_UNIT,
  DEFAULT_ROADMAP_STAGE,
  ESTIMATE_MAX_VALUE,
  ESTIMATE_UNITS,
  PROJECT_TASK_MESSAGES,
  ROADMAP_STAGES,
  roadmapStage,
  type EstimateUnit,
  type RoadmapStage,
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

/** The one control both the stage picker and the share toggle are built on the look of. */
const chipClass =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"

// Each stage its own colour, so a roadmap is read at a glance; the word is always there as well
const STAGE_COLOURS: Record<RoadmapStage, string> = {
  planned: "bg-surface-container-high text-on-surface-variant",
  "in-progress": "bg-secondary-fixed text-on-secondary-fixed-variant",
  done: "bg-success-container text-on-success-container",
}

/** Where a roadmap item has got to, as a tag. */
export const StageChip: React.FC<{ stage: RoadmapStage | null }> = ({ stage }) => {
  const words = roadmapStage(stage)
  return (
    <span className={`${chipClass} ${STAGE_COLOURS[words.id]}`} title={PROJECT_TASK_MESSAGES.stage}>
      {words.label}
    </span>
  )
}

interface StageSelectProps {
  value: RoadmapStage | null
  onChange: (stage: RoadmapStage) => void
  disabled?: boolean
  // What it is the stage of, so a screen reader hears which row this belongs to
  label: string
  className?: string
}

/**
 * Where a roadmap item has got to, changed where it is read. A plain `<select>`, the rule the
 * priority follows in this module: a menu of our own would have to be placed, clamped and closed on
 * every scroll, while this is what every phone, keyboard and screen reader already knows.
 */
export const StageSelect: React.FC<StageSelectProps> = ({ value, onChange, disabled, label, className = "" }) => {
  const stage = roadmapStage(value)
  return (
    <select
      value={stage.id}
      onChange={(event) => onChange(event.target.value as RoadmapStage)}
      // The whole row is a drag area, so the press that opens this never reaches it
      onPointerDown={(event) => event.stopPropagation()}
      disabled={disabled}
      aria-label={PROJECT_TASK_MESSAGES.stageOf(label)}
      className={`${chipClass} ${STAGE_COLOURS[stage.id]} cursor-pointer border-0 ${className}`}
    >
      {ROADMAP_STAGES.map((entry) => (
        <option key={entry.id} value={entry.id}>
          {entry.label}
        </option>
      ))}
    </select>
  )
}

/** The stage of a roadmap item while it is being written, beside how urgent it is. */
export const StageField: React.FC<{ stage: RoadmapStage | null; onChange: (stage: RoadmapStage) => void; disabled?: boolean }> = ({
  stage,
  onChange,
  disabled,
}) => (
  <div>
    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-outline">{PROJECT_TASK_MESSAGES.stage}</span>
    <select
      value={roadmapStage(stage).id}
      onChange={(event) => onChange(event.target.value as RoadmapStage)}
      disabled={disabled}
      aria-label={PROJECT_TASK_MESSAGES.stage}
      className="h-10 rounded-xl border border-outline-variant bg-white px-3 text-[13px] text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
    >
      {ROADMAP_STAGES.map((entry) => (
        <option key={entry.id} value={entry.id}>
          {entry.label}
        </option>
      ))}
    </select>
  </div>
)

/** What a roadmap item opens on: Planned, until someone says otherwise. */
export const defaultStage = (): RoadmapStage => DEFAULT_ROADMAP_STAGE

interface SignOffButtonProps {
  signedAt: string | null
  onSign: (signed: boolean) => void
  busy?: boolean
  // Read-only where the surface cannot write (a shared link on a tab it only reads)
  disabled?: boolean
  label: string
}

/**
 * Whether a piece of work has been **signed off as agreed**. One mark, and the day it was made:
 * **who signed is deliberately not stored**, at the owner's request, so there is nobody to name
 * here and anyone reading the project may sign.
 *
 * It says "Not signed" rather than showing nothing, because the point of it is that unsigned work
 * is visible; the word is always there, so the state never rests on colour alone.
 */
export const SignOffButton: React.FC<SignOffButtonProps> = ({ signedAt, onSign, busy, disabled, label }) => {
  const isSigned = Boolean(signedAt)
  const day = signedAt ? new Date(signedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : ""
  return (
    <button
      type="button"
      onClick={() => onSign(!isSigned)}
      onPointerDown={(event) => event.stopPropagation()}
      disabled={busy || disabled}
      aria-pressed={isSigned}
      title={isSigned ? `${PROJECT_TASK_MESSAGES.signedOn(day)}. ${PROJECT_TASK_MESSAGES.unsign}` : PROJECT_TASK_MESSAGES.signOffOf(label)}
      aria-label={isSigned ? `${label}: ${PROJECT_TASK_MESSAGES.signedOn(day)}` : PROJECT_TASK_MESSAGES.signOffOf(label)}
      className={`${chipClass} ${
        isSigned ? "bg-success text-on-success hover:bg-success/90" : "bg-surface-container-high text-outline hover:bg-primary/10 hover:text-primary"
      }`}
    >
      {busy ? (
        <Loader2 size={11} className="animate-spin" aria-hidden="true" />
      ) : isSigned ? (
        <Check size={11} aria-hidden="true" />
      ) : (
        <CircleDashed size={11} aria-hidden="true" />
      )}
      {isSigned ? (day ? PROJECT_TASK_MESSAGES.signedOn(day) : PROJECT_TASK_MESSAGES.signed) : PROJECT_TASK_MESSAGES.notSigned}
    </button>
  )
}

interface ShareToggleProps {
  isShared: boolean
  onChange: (isShared: boolean) => void
  busy?: boolean
  disabled?: boolean
  label: string
}

/**
 * Whether the client may read one note. A note is **internal until it is shared**, so nothing
 * reaches the project link by accident, and the word says which it is rather than an icon alone.
 */
export const ShareToggle: React.FC<ShareToggleProps> = ({ isShared, onChange, busy, disabled, label }) => (
  <button
    type="button"
    onClick={() => onChange(!isShared)}
    onPointerDown={(event) => event.stopPropagation()}
    disabled={busy || disabled}
    aria-pressed={isShared}
    title={PROJECT_TASK_MESSAGES.shareOf(label)}
    aria-label={PROJECT_TASK_MESSAGES.shareOf(label)}
    className={`${chipClass} ${
      isShared ? "bg-primary-fixed text-on-primary-fixed-variant hover:bg-primary-fixed/80" : "bg-surface-container-high text-outline hover:bg-primary/10 hover:text-primary"
    }`}
  >
    {busy ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : isShared ? <Eye size={11} aria-hidden="true" /> : <EyeOff size={11} aria-hidden="true" />}
    {isShared ? PROJECT_TASK_MESSAGES.shareWithClient : PROJECT_TASK_MESSAGES.internalNote}
  </button>
)
