"use client"

import React from "react"
import { Lock, LockOpen, Repeat } from "lucide-react"
import { PrioritySelect } from "@/components/ui/PriorityPicker"
import { DoerSelect } from "@/components/daily-tasks/DoerSelect"
import { DAILY_TASKS_MESSAGES } from "@/constants/dailyTasks"
import { type TaskChoices } from "@/lib/taskChoices"

/**
 * Everything a task carries besides its own words: how urgent it is, who does it, whether anything
 * is holding it up, and whether it comes back every day.
 *
 * It is one component so that the **same four choices are offered wherever a task is written or
 * read**: the Add task popup, the row that adds one more task to a day, the field that adds a
 * subtask, and every row of the list. They used to be set only after a task existed, which meant
 * writing a task and then going back over it to say what it was.
 *
 * The shape itself and its rules are `lib/taskChoices.ts`, so they can be tested without a browser.
 *
 * The two words are chips and the two yes-or-nos are toggles, which is what each one is: a choice
 * out of a short list reads as a chip, while a yes or no reads as a button that is on or off. A
 * toggle that is on says its word, so neither state ever rests on colour alone, and a toggle that
 * is off is a quiet icon, because most tasks are neither blocked nor repeating and a row has little
 * width to spare.
 */
interface ToggleProps {
  on: boolean
  onChange: (on: boolean) => void
  disabled?: boolean
  label: string
  words: { on: string; off: string; word: string }
  icons: { on: React.ReactNode; off: React.ReactNode }
  tone: string
}

const Toggle: React.FC<ToggleProps> = ({ on, onChange, disabled, label, words, icons, tone }) => (
  <button
    type="button"
    onPointerDown={(event) => event.stopPropagation()}
    onClick={() => onChange(!on)}
    disabled={disabled}
    aria-pressed={on}
    aria-label={`${on ? words.on : words.off}: ${label}`}
    title={on ? words.on : words.off}
    className={`flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60 ${
      on ? tone : "text-outline hover:bg-surface-container-high hover:text-on-surface"
    }`}
  >
    {on ? icons.on : icons.off}
    {on && words.word}
  </button>
)

interface TaskOptionsProps {
  value: TaskChoices
  // Only what changed, so a row can send each one as its own small write
  onChange: (change: Partial<TaskChoices>) => void
  disabled?: boolean
  // What these choices are about, for a screen reader
  label: string
  className?: string
}

export const TaskOptions: React.FC<TaskOptionsProps> = ({ value, onChange, disabled, label, className = "" }) => (
  <span className={`flex flex-wrap items-center gap-1 ${className}`}>
    <PrioritySelect value={value.priority} onChange={(priority) => onChange({ priority })} disabled={disabled} label={label} />
    <DoerSelect value={value.doer} onChange={(doer) => onChange({ doer })} disabled={disabled} label={label} />
    <Toggle
      on={value.isBlocked}
      onChange={(isBlocked) => onChange({ isBlocked })}
      disabled={disabled}
      label={label}
      words={{ on: DAILY_TASKS_MESSAGES.unblock, off: DAILY_TASKS_MESSAGES.block, word: DAILY_TASKS_MESSAGES.blocked }}
      icons={{ on: <Lock size={13} aria-hidden="true" />, off: <LockOpen size={13} aria-hidden="true" /> }}
      tone="bg-error-container text-error"
    />
    <Toggle
      on={value.repeats}
      onChange={(repeats) => onChange({ repeats })}
      disabled={disabled}
      label={label}
      words={{ on: DAILY_TASKS_MESSAGES.stopRepeating, off: DAILY_TASKS_MESSAGES.repeat, word: DAILY_TASKS_MESSAGES.repeats }}
      icons={{ on: <Repeat size={13} aria-hidden="true" />, off: <Repeat size={13} aria-hidden="true" /> }}
      tone="bg-primary-fixed text-on-primary-fixed-variant"
    />
  </span>
)
