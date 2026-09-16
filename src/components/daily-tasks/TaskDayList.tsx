"use client"

import React, { useState } from "react"
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react"
import { DAILY_TASKS_MESSAGES, TASK_MAX_LENGTH, VISIBLE_DAYS } from "@/constants/dailyTasks"
import { dayLabel } from "@/lib/taskDates"
import type { DailyTask, DailyTaskDay, DailyTasksPage } from "@/types/dailyTasks"

interface TaskDayListProps {
  page: DailyTasksPage | null
  today: string
  isLoading: boolean
  error: string | null
  // Tasks whose checkbox or deletion is still being saved
  pendingIds: ReadonlySet<string>
  onRetry: () => void
  onPageChange: (page: number) => void
  onToggle: (task: DailyTask, isCompleted: boolean) => void
  onDelete: (task: DailyTask) => void
  // Resolves true when the task was added, so the row can clear itself and stay open for the next
  onAddTask: (date: string, content: string) => Promise<boolean>
}

// Done is green, a day that has passed with the task still open is red, anything else is plain
const stateStyles = {
  done: "border-success/40 bg-success-container/60",
  overdue: "border-error/40 bg-error-container/50",
  open: "border-outline-variant bg-surface-container-lowest",
} as const

const boxStyles = {
  done: "border-success bg-success text-on-success",
  overdue: "border-error text-error",
  open: "border-outline-variant text-transparent",
} as const

const taskState = (task: DailyTask, today: string): keyof typeof stateStyles =>
  task.isCompleted ? "done" : task.taskDate < today ? "overdue" : "open"

/**
 * One task: a checkbox with its text, and a delete button beside it. The label covers only the
 * checkbox and the text, so deleting never ticks the task off by accident.
 */
const TaskRow: React.FC<{
  task: DailyTask
  today: string
  isPending: boolean
  onToggle: (task: DailyTask, isCompleted: boolean) => void
  onDelete: (task: DailyTask) => void
}> = ({ task, today, isPending, onToggle, onDelete }) => {
  const state = taskState(task, today)
  return (
    <li className={`flex items-start gap-1 rounded-xl border pr-1 transition-colors ${stateStyles[state]}`}>
      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 p-3">
        <input
          type="checkbox"
          checked={task.isCompleted}
          onChange={(event) => onToggle(task, event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-focus-visible:ring-offset-2 ${boxStyles[state]}`}
        >
          {state === "overdue" ? <XCircle size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
        </span>
        <span
          className={`min-w-0 flex-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed ${
            state === "done" ? "text-on-success-container" : state === "overdue" ? "text-on-error-container" : "text-on-surface"
          }`}
        >
          {task.content}
        </span>
        {state === "overdue" && (
          <span className="shrink-0 rounded-full bg-error/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-error">
            Overdue
          </span>
        )}
      </label>
      {isPending ? (
        <span className="p-2.5" aria-hidden="true">
          <Loader2 size={15} className="animate-spin text-outline" />
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onDelete(task)}
          aria-label={`Delete task: ${task.content}`}
          className="mt-1 shrink-0 rounded-lg p-2 text-outline transition-colors hover:bg-error/10 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      )}
    </li>
  )
}

/**
 * Adds one more task to a day already on the list. Enter saves it and keeps the row open for the
 * next one, so a forgotten task takes one click and a line of typing.
 */
const AddToDayRow: React.FC<{ date: string; onAddTask: (date: string, content: string) => Promise<boolean> }> = ({
  date,
  onAddTask,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [content, setContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const save = async () => {
    if (isSaving || !content.trim()) return
    setIsSaving(true)
    const added = await onAddTask(date, content.trim())
    setIsSaving(false)
    if (added) setContent("")
  }

  if (!isOpen) {
    return (
      <li>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Plus size={14} aria-hidden="true" />
          Add task to this day
        </button>
      </li>
    )
  }

  return (
    <li className="flex items-center gap-2">
      <input
        autoFocus
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            void save()
          } else if (event.key === "Escape") {
            setContent("")
            setIsOpen(false)
          }
        }}
        onBlur={() => {
          if (!content.trim() && !isSaving) setIsOpen(false)
        }}
        maxLength={TASK_MAX_LENGTH}
        disabled={isSaving}
        aria-label={`New task for ${date}`}
        placeholder="One more task... (Enter to add)"
        className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-[13px] text-on-surface placeholder:text-outline focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
      />
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={save}
        disabled={isSaving || !content.trim()}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
        Add
      </button>
    </li>
  )
}

/**
 * One day: its heading, how much of it is done, its tasks in the order they were written, and a
 * row for adding one more.
 */
const DayGroup: React.FC<{
  day: DailyTaskDay
  today: string
  pendingIds: ReadonlySet<string>
  onToggle: (task: DailyTask, isCompleted: boolean) => void
  onDelete: (task: DailyTask) => void
  onAddTask: (date: string, content: string) => Promise<boolean>
}> = ({ day, today, pendingIds, onToggle, onDelete, onAddTask }) => {
  const { title, detail } = dayLabel(day.date, today)
  const done = day.tasks.filter((task) => task.isCompleted).length
  const overdue = day.tasks.some((task) => !task.isCompleted && task.taskDate < today)

  return (
    <li>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="flex items-center gap-2 text-[13px] font-bold text-on-surface">
          {title}
          {detail && <span className="text-[11px] font-medium text-outline">{detail}</span>}
          {overdue && <AlertTriangle size={13} className="text-error" aria-label="Has overdue tasks" />}
        </h3>
        <span className={`text-[11px] font-semibold ${done === day.tasks.length ? "text-success" : "text-outline"}`}>
          {done} of {day.tasks.length} done
        </span>
      </div>
      <ul className="space-y-1.5">
        {day.tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            today={today}
            isPending={pendingIds.has(task.id)}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))}
        <AddToDayRow date={day.date} onAddTask={onAddTask} />
      </ul>
    </li>
  )
}

/**
 * The task list: the last seven days first, then older days a week at a time. Each day keeps its
 * own heading, so the order stays readable across pages.
 */
export const TaskDayList: React.FC<TaskDayListProps> = ({
  page,
  today,
  isLoading,
  error,
  pendingIds,
  onRetry,
  onPageChange,
  onToggle,
  onDelete,
  onAddTask,
}) => {
  const current = page?.page ?? 1
  const pageCount = page?.pageCount ?? 1
  const hasDays = (page?.days.length ?? 0) > 0

  return (
    <section
      aria-label="Your tasks"
      className="flex min-h-[320px] flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm lg:min-h-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-on-surface">{current === 1 ? `Last ${VISIBLE_DAYS} Days` : "Older Tasks"}</h2>
        {page && (
          <span className="text-[11px] text-outline">
            {current === 1 ? `From ${page.windowStart}` : `Page ${current} of ${pageCount}`}
          </span>
        )}
      </div>

      {error ? (
        <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-error-container text-error">
            <AlertTriangle size={20} aria-hidden="true" />
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-on-surface-variant">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : isLoading && !page ? (
        <div role="status" className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center">
          <Loader2 size={22} className="animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold text-on-surface">Loading your tasks...</p>
        </div>
      ) : !hasDays ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/5 text-primary">
            <ListTodo size={20} aria-hidden="true" />
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-on-surface-variant">
            {current === 1 ? DAILY_TASKS_MESSAGES.empty : DAILY_TASKS_MESSAGES.emptyHistory}
          </p>
        </div>
      ) : (
        <ul aria-busy={isLoading} className="custom-scrollbar flex-1 space-y-4 overflow-y-auto pr-1">
          {page?.days.map((day) => (
            <DayGroup
              key={day.date}
              day={day}
              today={today}
              pendingIds={pendingIds}
              onToggle={onToggle}
              onDelete={onDelete}
              onAddTask={onAddTask}
            />
          ))}
        </ul>
      )}

      {pageCount > 1 && !error && (
        <nav aria-label="Task pages" className="flex items-center justify-between gap-2 border-t border-outline-variant pt-3">
          <button
            type="button"
            onClick={() => onPageChange(current - 1)}
            disabled={current <= 1 || isLoading}
            className="inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft size={14} aria-hidden="true" />
            Newer
          </button>
          <span className="text-[11px] text-outline" aria-live="polite">
            Page {current} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(current + 1)}
            disabled={current >= pageCount || isLoading}
            className="inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
          >
            Older
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </nav>
      )}
    </section>
  )
}
