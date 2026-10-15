"use client"

import React from "react"

/**
 * A small coloured chip that is also the control that changes it: how urgent something is, who does
 * it, and anything else that is one word out of a short fixed list.
 *
 * It is a plain `<select>` rather than a menu of our own: a chip that opens a list has to be placed,
 * clamped and closed on every scroll (see Meeting Planner's status menu), while a select is what
 * every phone, every keyboard and every screen reader already knows, which is what a list of
 * hundreds of rows wants. The word is always in the chip, so it never rests on colour.
 */
export interface ChipOption<Id extends string> {
  id: Id
  label: string
}

interface ChipSelectProps<Id extends string> {
  value: Id
  options: readonly ChipOption<Id>[]
  tone: string
  onChange: (value: Id) => void
  disabled?: boolean
  // What this is the choice of, for a screen reader, since the control carries no words of its own
  label: string
  className?: string
}

export function ChipSelect<Id extends string>({ value, options, tone, onChange, disabled, label, className = "" }: ChipSelectProps<Id>) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as Id)}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`h-7 cursor-pointer rounded-full border-0 px-2 text-[10px] font-bold uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60 ${tone} ${className}`}
    >
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
