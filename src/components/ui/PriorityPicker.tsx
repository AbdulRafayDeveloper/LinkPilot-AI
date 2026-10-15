"use client"

import React from "react"
import { ChipSelect } from "@/components/ui/ChipSelect"
import { PRIORITIES, PRIORITY_TONE, priorityLabel, priorityOf, type Priority } from "@/constants/priorities"

/**
 * How urgent something is, shown as a tag and changed where it is read. Shared by Client Projects
 * (every tab) and Daily Tasks, so the three words look and behave the same wherever they appear.
 *
 * The control itself is the shared `ChipSelect`, which Daily Tasks' "who does it" uses too, so the
 * chips on one row cannot drift apart.
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
    <ChipSelect
      value={words.id}
      options={PRIORITIES}
      tone={PRIORITY_TONE[words.id]}
      onChange={onChange}
      disabled={disabled}
      label={priorityLabel(label)}
      className={className}
    />
  )
}
