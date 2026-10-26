"use client"

import React from "react"
import { CheckCircle2 } from "lucide-react"

export interface RadioCardOption<Id extends string> {
  id: Id
  label: string
  description: string
}

interface RadioCardGroupProps<Id extends string> {
  name: string
  legend: string
  options: readonly RadioCardOption<Id>[]
  value: Id | null
  onChange: (id: Id) => void
  disabled?: boolean
  invalid?: boolean
  /**
   * Grid column classes. Left out, the cards fill **the width they are given**, as many 8.5rem cards a
   * row as fit: the same group sits in a narrow form column on a laptop and full width on a phone, so
   * only the space it really has can say how many fit.
   */
  columnsClassName?: string
}

// As many cards a row as fit at 8.5rem each, and never wider than the group itself. 8.5rem is what
// puts two cards side by side in a 300px form column (a laptop's) and on a 360px phone; at 10rem nine
// tones stood one a row and the form ran far below the button that uses them
export const FIT_CARD_COLUMNS = "grid-cols-[repeat(auto-fill,minmax(min(100%,8.5rem),1fr))]"

/**
 * Single-choice option cards built on native radio inputs, so arrow keys and screen
 * readers work without extra code.
 *
 * **Every card shows its whole name and its whole description, on every screen**: both wrap rather
 * than being cut short, and nothing is hidden on a short window. A page that runs longer than the
 * window scrolls, which is far easier to use than a card that says "Thought..." with the rest in a tooltip.
 */
export function RadioCardGroup<Id extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  disabled = false,
  invalid = false,
  columnsClassName = FIT_CARD_COLUMNS,
}: RadioCardGroupProps<Id>) {
  return (
    <fieldset disabled={disabled} aria-invalid={invalid} className="min-w-0">
      <legend className="text-[10px] font-bold text-outline uppercase tracking-wider mb-2">{legend}</legend>
      <div className={`grid ${columnsClassName} gap-2`}>
        {options.map((option) => {
          const isSelected = value === option.id
          return (
            <label
              key={option.id}
              className={`relative flex items-start gap-2 min-w-0 cursor-pointer rounded-xl border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-primary/40 ${
                isSelected
                  ? "bg-primary-container border-primary-container text-on-primary-container"
                  : `bg-white text-on-surface hover:bg-surface-container-low ${invalid ? "border-error" : "border-outline-variant"}`
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={isSelected}
                onChange={() => onChange(option.id)}
                className="sr-only"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-tight break-words">{option.label}</span>
                <span className={`block text-[11px] leading-snug mt-0.5 break-words ${isSelected ? "text-on-primary-container/80" : "text-outline"}`}>
                  {option.description}
                </span>
              </span>
              {isSelected && <CheckCircle2 size={16} className="shrink-0 mt-0.5" aria-hidden="true" />}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
