"use client"

import React from "react"
import { PRIORITIES, PRIORITY_TONE, priorityLabel, priorityOf, type Priority } from "@/constants/priorities"

/**
 * How urgent something is, shown as a tag and changed where it is read. Shared by Client Projects
 * (every tab) and Daily Tasks, so the three words look and behave the same wherever they appear.
 *
 * It is a plain `<select>` rather than a menu of our own: a chip that opens a list has to be placed,
 * clamped and closed on every scroll (see Meeting Planner's status menu), while a select is what
 * every phone, every keyboard and every screen reader already knows, which is what a list of
 * hundreds of rows wants.
 */

/** How urgent something is, read only: the control below is how it changes. */
export const PriorityChip: React.FC<{ priority: Priority; className?: string }> = ({ priority, className = "" }) => {
  const words = priorityOf(priority)
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${PRIORITY_TONE[words.id]} ${className}`}>
      {words.label}
    </span>
  )
}

interface PrioritySelectProps {
  value: Priority
  onChange: (priority: Priority) => void
  disabled?: boolean
  // What it is the priority of, for a screen reader, since the control itself carries no words
  label: string
  className?: string
}

export const PrioritySelect: React.FC<PrioritySelectProps> = ({ value, onChange, disabled, label, className = "" }) => {
  const words = priorityOf(value)
  return (
    <select
      value={words.id}
      onChange={(event) => onChange(event.target.value as Priority)}
      disabled={disabled}
      aria-label={priorityLabel(label)}
      title={priorityLabel(label)}
      className={`h-7 cursor-pointer rounded-full border-0 px-2 text-[10px] font-bold uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60 ${PRIORITY_TONE[words.id]} ${className}`}
    >
      {PRIORITIES.map((priority) => (
        <option key={priority.id} value={priority.id}>
          {priority.label}
        </option>
      ))}
    </select>
  )
}
