"use client"

import React from "react"
import { Lock, LockOpen, Repeat } from "lucide-react"
import { PrioritySelect } from "@/components/ui/PriorityPicker"
import { DoerSelect } from "@/components/daily-tasks/DoerSelect"
import { DAILY_TASKS_MESSAGES } from "@/constants/dailyTasks"
import { type TaskChoices } from "@/lib/taskChoices"
import { FIRST_REPEAT, NO_REPEAT, TASK_REPEATS, repeatWords, type TaskRepeat } from "@/lib/taskRepeat"

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

/**
 * How often a task comes back. A task that happens once is **the quiet icon**, like the blocked
 * toggle beside it, because nearly every task happens once and a row has no width to spend saying
 * so; one press makes it daily. Once it repeats it becomes the interval itself, so changing Daily
 * to Weekly is one choice rather than a second control that is empty most of the time, and Once is
 * the way back out of the list.
 */
const RepeatControl: React.FC<{ value: TaskRepeat; onChange: (repeat: TaskRepeat) => void; disabled?: boolean; label: string }> = ({
  value,
  onChange,
  disabled,
  label,
}) => {
  const words = repeatWords(value)
  if (!words) {
    return (
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onChange(FIRST_REPEAT)}
        disabled={disabled}
        aria-pressed={false}
        aria-label={`${DAILY_TASKS_MESSAGES.repeat}: ${label}`}
        title={DAILY_TASKS_MESSAGES.repeat}
        className="flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-bold uppercase tracking-wide text-outline transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Repeat size={13} aria-hidden="true" />
      </button>
    )
  }
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as TaskRepeat)}
      onPointerDown={(event) => event.stopPropagation()}
      disabled={disabled}
      aria-label={`${DAILY_TASKS_MESSAGES.repeatsEvery(words.due)}: ${label}`}
      title={DAILY_TASKS_MESSAGES.repeatsEvery(words.due)}
      className="h-7 shrink-0 cursor-pointer rounded-full border-0 bg-primary-fixed px-2 text-[10px] font-bold uppercase tracking-wide text-on-primary-fixed-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {TASK_REPEATS.map((kind) => (
        <option key={kind.id} value={kind.id}>
          {kind.label}
        </option>
      ))}
      <option value={NO_REPEAT}>{DAILY_TASKS_MESSAGES.once}</option>
    </select>
  )
}

interface TaskOptionsProps {
  value: TaskChoices
  // Only what changed, so a row can send each one as its own small write
  onChange: (change: Partial<TaskChoices>) => void
  disabled?: boolean
  // What these choices are about, for a screen reader
  label: string
  className?: string
}

/**
 * The two chips alone: how urgent a task is and who does it. The list's rows show these beside the
 * task and keep blocking and repeating behind the row's menu (`TaskRowMenu`), at the owner's
 * request; everywhere a task is **written** the full `TaskOptions` still offers all four.
 */
export const TaskChips: React.FC<TaskOptionsProps> = ({ value, onChange, disabled, label, className = "" }) => (
  <span className={`flex flex-wrap items-center gap-1 ${className}`}>
    <PrioritySelect value={value.priority} onChange={(priority) => onChange({ priority })} disabled={disabled} label={label} />
    <DoerSelect value={value.doer} onChange={(doer) => onChange({ doer })} disabled={disabled} label={label} />
  </span>
)

/**
 * What a row says about a task that is blocked or repeating, now that the controls for both live in
 * the row's menu: a word in the state's colour, never a bare icon, so the state is still read off
 * the row at a glance and never rests on colour alone. Nothing for a task that is neither.
 */
export const TaskFlagBadges: React.FC<{ value: TaskChoices }> = ({ value }) => {
  const repeat = repeatWords(value.repeat)
  if (!value.isBlocked && !repeat) return null
  return (
    <>
      {value.isBlocked && (
        <span title={DAILY_TASKS_MESSAGES.block} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-error-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-error">
          <Lock size={11} aria-hidden="true" />
          {DAILY_TASKS_MESSAGES.blocked}
        </span>
      )}
      {repeat && (
        <span title={DAILY_TASKS_MESSAGES.repeatsEvery(repeat.due)} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-fixed px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-primary-fixed-variant">
          <Repeat size={11} aria-hidden="true" />
          {repeat.label}
        </span>
      )}
    </>
  )
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
    <RepeatControl value={value.repeat} onChange={(repeat) => onChange({ repeat })} disabled={disabled} label={label} />
  </span>
)
