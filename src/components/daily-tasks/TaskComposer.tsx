"use client"

import React, { useRef } from "react"
import { CalendarDays, ListPlus, Loader2, Plus, X } from "lucide-react"
import { INITIAL_TASK_ROWS, MAX_TASKS_PER_SUBMIT, TASK_MAX_LENGTH } from "@/constants/dailyTasks"

interface TaskComposerProps {
  today: string
  taskDate: string
  rows: string[]
  isSaving: boolean
  error: string | null
  notice: string | null
  onDateChange: (date: string) => void
  onRowsChange: (rows: string[]) => void
  onSubmit: () => void
}

export const emptyRows = (): string[] => Array.from({ length: INITIAL_TASK_ROWS }, () => "")

const rowClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"

/**
 * Writes a whole day of tasks in one go: the day, then one row per task. Enter opens the next
 * row, pasting a list fills a row each, and one Save writes them all. Empty rows are ignored,
 * so the spare rows on screen cost nothing.
 */
export const TaskComposer: React.FC<TaskComposerProps> = ({
  today,
  taskDate,
  rows,
  isSaving,
  error,
  notice,
  onDateChange,
  onRowsChange,
  onSubmit,
}) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const filled = rows.filter((row) => row.trim()).length
  const isFull = rows.length >= MAX_TASKS_PER_SUBMIT

  const focusRow = (index: number) => {
    window.requestAnimationFrame(() => inputsRef.current[index]?.focus())
  }

  const setRow = (index: number, value: string) => {
    onRowsChange(rows.map((row, position) => (position === index ? value : row)))
  }

  const addRow = (afterIndex = rows.length - 1) => {
    if (isFull) return
    const next = [...rows]
    next.splice(afterIndex + 1, 0, "")
    onRowsChange(next)
    focusRow(afterIndex + 1)
  }

  const removeRow = (index: number) => {
    if (rows.length === 1) {
      onRowsChange([""])
      focusRow(0)
      return
    }
    onRowsChange(rows.filter((_, position) => position !== index))
    focusRow(Math.max(0, index - 1))
  }

  // A pasted list becomes one task per line, which is how a day of tasks usually arrives
  const pasteRows = (index: number, event: React.ClipboardEvent<HTMLInputElement>) => {
    const lines = event.clipboardData
      .getData("text")
      .split(/\r?\n/)
      .filter((line) => line.trim())
    if (lines.length < 2) return
    event.preventDefault()
    const next = [...rows.slice(0, index), ...lines, ...rows.slice(index + 1)].slice(0, MAX_TASKS_PER_SUBMIT)
    onRowsChange(next)
    focusRow(Math.min(index + lines.length, next.length) - 1)
  }

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault()
      onSubmit()
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      if (index === rows.length - 1) addRow(index)
      else focusRow(index + 1)
      return
    }
    // Backspace on an empty row closes it, the way a list in a notes app behaves
    if (event.key === "Backspace" && rows[index] === "" && rows.length > 1) {
      event.preventDefault()
      removeRow(index)
    }
  }

  return (
    <section
      aria-label="Add tasks"
      className="flex min-h-0 flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-on-surface">Add Tasks</h2>
        <span className="text-[11px] text-outline">
          {rows.length} {rows.length === 1 ? "row" : "rows"} · max {MAX_TASKS_PER_SUBMIT}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[10rem] flex-1">
          <label htmlFor="daily-task-date" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-outline">
            Task date
          </label>
          <div className="relative">
            <CalendarDays
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline"
              aria-hidden="true"
            />
            <input
              id="daily-task-date"
              type="date"
              value={taskDate}
              max={today}
              disabled={isSaving}
              onChange={(event) => onDateChange(event.target.value)}
              className={`${rowClass} pl-9`}
            />
          </div>
        </div>
        {taskDate !== today && (
          <button
            type="button"
            onClick={() => onDateChange(today)}
            disabled={isSaving}
            className="rounded-xl border border-outline-variant px-3 py-2.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
          >
            Use today
          </button>
        )}
      </div>

      <ul className="custom-scrollbar flex max-h-[42vh] flex-col gap-2 overflow-y-auto pr-1 lg:max-h-none lg:overflow-visible">
        {rows.map((row, index) => (
          <li key={index} className="flex items-center gap-2">
            <input
              ref={(element) => {
                inputsRef.current[index] = element
              }}
              value={row}
              onChange={(event) => setRow(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              onPaste={(event) => pasteRows(index, event)}
              maxLength={TASK_MAX_LENGTH}
              disabled={isSaving}
              aria-label={`Task ${index + 1}`}
              placeholder={index === 0 ? "What needs doing today?" : "Another task"}
              className={rowClass}
            />
            <button
              type="button"
              onClick={() => removeRow(index)}
              disabled={isSaving || (rows.length === 1 && row === "")}
              aria-label={`Remove task ${index + 1}`}
              className="shrink-0 rounded-lg p-2 text-outline transition-colors hover:bg-surface-container-high hover:text-error disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => addRow()}
          disabled={isSaving || isFull}
          className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={14} aria-hidden="true" />
          Add row
        </button>
        <span className="text-[11px] text-outline">Enter opens a row · Ctrl + Enter saves</span>
      </div>

      <div className="min-h-[20px] text-[12px]" aria-live="polite">
        {error && (
          <p role="alert" className="text-error">
            {error}
          </p>
        )}
        {!error && notice && <p className="text-primary">{notice}</p>}
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={isSaving || filled === 0}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <ListPlus size={16} aria-hidden="true" />}
        {isSaving ? "Adding..." : filled > 1 ? `Add ${filled} tasks` : "Add task"}
      </button>
    </section>
  )
}
