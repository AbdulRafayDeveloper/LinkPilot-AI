"use client"

import React from "react"
import { ChipSelect } from "@/components/ui/ChipSelect"
import { TASK_DOERS, TASK_DOER_TONE, doerLabel, doerOf, type TaskDoer } from "@/constants/taskDoers"

/**
 * Who does a task: me, or an employee. The same chip the priority uses (`ChipSelect`), so the two
 * controls on a row are one size, one shape and one behaviour.
 */
interface DoerSelectProps {
  value: TaskDoer
  onChange: (doer: TaskDoer) => void
  disabled?: boolean
  // What the choice is about, for a screen reader
  label: string
  className?: string
}

export const DoerSelect: React.FC<DoerSelectProps> = ({ value, onChange, disabled, label, className = "" }) => {
  const words = doerOf(value)
  return (
    <ChipSelect
      value={words.id}
      options={TASK_DOERS}
      tone={TASK_DOER_TONE[words.id]}
      onChange={onChange}
      disabled={disabled}
      label={doerLabel(label)}
      className={className}
    />
  )
}
