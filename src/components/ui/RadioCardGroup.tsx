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
  // Grid column classes; two columns from the sm breakpoint by default
  columnsClassName?: string
  // Wrap long option labels onto a second line instead of truncating them
  wrapLabels?: boolean
}

/**
 * Single-choice option cards built on native radio inputs, so arrow keys and screen
 * readers work without extra code.
 */
export function RadioCardGroup<Id extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  disabled = false,
  invalid = false,
  columnsClassName = "grid-cols-1 sm:grid-cols-2",
  wrapLabels = false,
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
                <span className={`block text-sm font-semibold leading-tight ${wrapLabels ? "break-words" : "truncate"}`}>
                  {option.label}
                </span>
                <span
                  className={`block text-[11px] leading-tight mt-0.5 truncate ${
                    isSelected ? "text-on-primary-container/80" : "text-outline"
                  }`}
                >
                  {option.description}
                </span>
              </span>
              {/* Wrapped cards are narrow, so their checkmark sits on the corner instead of taking text width */}
              {isSelected && (
                <CheckCircle2
                  size={16}
                  className={
                    wrapLabels ? "absolute -top-1.5 -right-1.5 rounded-full bg-white text-primary" : "shrink-0 mt-0.5"
                  }
                  aria-hidden="true"
                />
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
