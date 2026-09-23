"use client"

import React, { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { CSS } from "@dnd-kit/utilities"
import {
  AlertTriangle,
  CalendarArrowUp,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  CornerDownRight,
  GripVertical,
  ListPlus,
  Paperclip,
  ListTodo,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react"
import { DAILY_TASKS_MESSAGES, TASK_MAX_LENGTH, VISIBLE_DAYS } from "@/constants/dailyTasks"
import { TASK_ATTACHMENT_MESSAGES, TASK_MAX_DEPTH } from "@/constants/taskAttachments"
import { dayLabel } from "@/lib/taskDates"
import type { DailyTask, DailyTaskDay, DailyTasksPage } from "@/types/dailyTasks"
import { TaskDetailsFields } from "@/components/tasks/TaskDetailsFields"
import { TaskDetailsView } from "@/components/tasks/TaskDetailsView"
import { CopyTaskText } from "@/components/tasks/CopyTaskText"
import { emptyTaskDetails, hasTaskDetails, type TaskDetailsDraft } from "@/types/taskAttachment"

/** Tasks dropped somewhere new: the day they now belong to, that day's whole order, and every day as it now looks. */
export interface TaskMove {
  // Everything that moved: one task for an ordinary drag, the whole selection when several travelled together
  tasks: DailyTask[]
  // The one that was under the pointer, which the move is saved against
  dragged: DailyTask
  toDate: string
  orderedIds: string[]
  days: DailyTaskDay[]
}

/** A plain pick, or everything between the last pick and this one. */
export type SelectMode = "toggle" | "range"

/** Adding one task to a day already on the list, with whatever detail was opened on it. */
export type AddTaskHandler = (date: string, content: string, details?: TaskDetailsDraft) => Promise<boolean>

interface TaskDayListProps {
  page: DailyTasksPage | null
  today: string
  isLoading: boolean
  error: string | null
  // Tasks whose checkbox, deletion or move is still being saved
  pendingIds: ReadonlySet<string>
  onRetry: () => void
  onPageChange: (page: number) => void
  onToggle: (task: DailyTask, isCompleted: boolean) => void
  onDelete: (task: DailyTask) => void
  // Opens the task's editor: its details and subtasks; `focusSubtask` puts the caret in "Add subtask"
  onOpenTask: (task: DailyTask, focusSubtask?: boolean) => void
  // Brings one overdue task, with its subtasks, onto today
  onMoveToToday: (task: DailyTask) => void
  // Deletes every picked task at once; the page confirms first, since deleting is final
  onDeletePicked: (ids: string[]) => void
  onMove: (move: TaskMove) => void
  // Resolves true when the task was added, so the row can clear itself and stay open for the next
  onAddTask: AddTaskHandler
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

// A day's drop zone is named apart from the tasks in it, so dropping on an empty day still has a target
const DAY_PREFIX = "day:"
const dayZoneId = (date: string) => `${DAY_PREFIX}${date}`

// Settles quickly and without a bounce, so a drop feels placed rather than thrown
const DROP_ANIMATION: DropAnimation = { duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }

// The day a task (or a day's drop zone) is in, within the days as they look mid-drag
function dateOf(days: DailyTaskDay[], id: UniqueIdentifier): string | null {
  const key = String(id)
  if (key.startsWith(DAY_PREFIX)) return key.slice(DAY_PREFIX.length)
  return days.find((day) => day.tasks.some((task) => task.id === key))?.date ?? null
}

interface TaskRowBodyProps {
  task: DailyTask
  today: string
  isPending: boolean
  onToggle?: (task: DailyTask, isCompleted: boolean) => void
  onDelete?: (task: DailyTask) => void
  // Opens the task's editor (details and subtasks); absent on the dragged copy
  onOpenTask?: (task: DailyTask, focusSubtask?: boolean) => void
  onMoveToToday?: (task: DailyTask) => void
  handle: React.ReactNode
  // Picking tasks to move together: one click on the circle picks a task, Shift picks a run of them
  isSelected?: boolean
  onSelect?: (task: DailyTask, mode: SelectMode) => void
  // A click that ends a drag is not a click on the task
  wasDragging?: () => boolean
}

/**
 * What a task shows: the grip, a circle for picking it, a checkbox with its text, and a delete
 * button. The whole row is the drag area, so the circle, the checkbox and delete each stop the click
 * from reaching it, and a click that only ended a drag never ticks the task. Without handlers it is
 * the copy that follows the pointer during a drag.
 */
const TaskRowBody: React.FC<TaskRowBodyProps> = ({
  task,
  today,
  isPending,
  onToggle,
  onDelete,
  onOpenTask,
  onMoveToToday,
  handle,
  isSelected = false,
  onSelect,
  wasDragging,
}) => {
  const state = taskState(task, today)
  return (
    <>
      {handle}
      {onSelect && (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(task, event.shiftKey ? "range" : "toggle")
          }}
          aria-pressed={isSelected}
          aria-label={`Pick "${task.content}" to move it with other tasks`}
          title="Pick this task, then drag any picked task to move them together"
          className={`mt-2.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            isSelected ? "border-primary bg-primary text-white" : "border-outline-variant text-transparent hover:border-primary/60"
          }`}
        >
          <Check size={12} aria-hidden="true" />
        </button>
      )}
      <label
        onClick={(event) => {
          // The row is the drag area, so a click that only finished a drag must not tick the task
          if (wasDragging?.()) event.preventDefault()
        }}
        className={`flex min-w-0 flex-1 items-start gap-3 py-3 pr-3 ${onToggle ? "cursor-pointer" : ""}`}
      >
        <input
          type="checkbox"
          checked={task.isCompleted}
          onChange={(event) => onToggle?.(task, event.target.checked)}
          disabled={!onToggle}
          tabIndex={onToggle ? undefined : -1}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-focus-visible:ring-offset-2 ${boxStyles[state]}`}
        >
          {state === "overdue" ? <XCircle size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block whitespace-pre-wrap break-words text-[13px] leading-relaxed ${
              state === "done" ? "text-on-success-container" : state === "overdue" ? "text-on-error-container" : "text-on-surface"
            }`}
          >
            {task.content}
          </span>
          {/* Whatever optional detail was added when the task was written, under its own line */}
          <TaskDetailsView description={task.description} images={task.images} label={task.content} />
        </span>
        {state === "overdue" && (
          <span className="shrink-0 rounded-full bg-error/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-error">
            Overdue
          </span>
        )}
      </label>
      {/* The task's details and subtasks open in a popup rather than in the row: the whole row is the
          drag area, so typing or picking an image inside it would start a drag */}
      <RowActions task={task} depth={1} isPending={isPending} isOverdue={state === "overdue"} onOpenTask={onOpenTask} onMoveToToday={onMoveToToday} />
      {isPending ? (
        <span className="p-2.5" aria-hidden="true">
          <Loader2 size={15} className="animate-spin text-outline" />
        </span>
      ) : onDelete ? (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onDelete(task)}
          aria-label={`Delete task: ${task.content}`}
          className="mt-1 shrink-0 rounded-lg p-2 text-outline transition-colors hover:bg-error/10 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      ) : (
        <span className="mt-1 shrink-0 p-2 text-outline" aria-hidden="true">
          <Trash2 size={15} />
        </span>
      )}
    </>
  )
}

const actionClass =
  "mt-1 shrink-0 rounded-lg p-2 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40"

/**
 * What can be done to a task besides ticking and deleting it: open its details, add a subtask (the
 * third level has none, so its button says why instead), **copy its line** to the clipboard, and,
 * while it is overdue, bring it onto today. Every button stops the press from reaching the row, which
 * is the drag area. Without handlers (the copy under the pointer, or a task still saving) the same
 * space is kept, so nothing shifts.
 */
const RowActions: React.FC<{
  task: DailyTask
  depth: number
  isPending: boolean
  // Only a task of an earlier day that still has open work, so the button says what it will do
  isOverdue?: boolean
  onOpenTask?: (task: DailyTask, focusSubtask?: boolean) => void
  onMoveToToday?: (task: DailyTask) => void
}> = ({ task, depth, isPending, isOverdue = false, onOpenTask, onMoveToToday }) => {
  const hasDetails = Boolean(task.description || task.images.length > 0)
  if (!onOpenTask || isPending) {
    return (
      <span className="mt-1 flex shrink-0 text-outline" aria-hidden="true">
        <span className="p-2"><Paperclip size={15} /></span>
        <span className="p-2"><ListPlus size={15} /></span>
        <span className="p-2"><Copy size={15} /></span>
      </span>
    )
  }
  const canNest = depth < TASK_MAX_DEPTH
  const addLabel = depth === 1 ? TASK_ATTACHMENT_MESSAGES.addSubtask : TASK_ATTACHMENT_MESSAGES.addSubSubtask
  const stop = (event: React.SyntheticEvent) => event.stopPropagation()
  return (
    <>
      <button
        type="button"
        onPointerDown={stop}
        onMouseDown={stop}
        onClick={() => onOpenTask(task)}
        aria-label={`${hasDetails ? "Edit" : "Add"} details: ${task.content}`}
        title={hasDetails ? "Open the details and subtasks" : "Add a description, images or subtasks"}
        className={`${actionClass} ${hasDetails ? "text-primary" : "text-outline"}`}
      >
        <Paperclip size={15} aria-hidden="true" />
      </button>
      <button
        type="button"
        onPointerDown={stop}
        onMouseDown={stop}
        onClick={() => onOpenTask(task, true)}
        disabled={!canNest}
        aria-label={canNest ? `${addLabel}: ${task.content}` : TASK_ATTACHMENT_MESSAGES.depthReached}
        title={canNest ? addLabel : TASK_ATTACHMENT_MESSAGES.depthReached}
        className={`${actionClass} text-outline`}
      >
        <ListPlus size={15} aria-hidden="true" />
      </button>
      <CopyTaskText text={task.content} label={`${TASK_ATTACHMENT_MESSAGES.copyText}: ${task.content}`} className={`${actionClass} text-outline`} />
      {isOverdue && onMoveToToday && (
        <button
          type="button"
          onPointerDown={stop}
          onMouseDown={stop}
          onClick={() => onMoveToToday(task)}
          aria-label={`${DAILY_TASKS_MESSAGES.moveThisOverdue}: ${task.content}`}
          title={DAILY_TASKS_MESSAGES.moveThisOverdue}
          className={`${actionClass} text-error`}
        >
          <CalendarArrowUp size={15} aria-hidden="true" />
        </button>
      )}
    </>
  )
}

interface SubtaskTreeProps {
  tasks: DailyTask[]
  // 2 for a task's subtasks, 3 for theirs
  depth: number
  today: string
  pendingIds: ReadonlySet<string>
  onToggle: (task: DailyTask, isCompleted: boolean) => void
  onDelete: (task: DailyTask) => void
  onOpenTask: (task: DailyTask, focusSubtask?: boolean) => void
}

/** One subtask: its tick box and line, its details, its actions, and its own subtasks under it. */
const SubtaskItem: React.FC<SubtaskTreeProps & { task: DailyTask }> = ({ task, depth, today, pendingIds, onToggle, onDelete, onOpenTask }) => {
  const [isOpen, setIsOpen] = useState(true)
  const isPending = pendingIds.has(task.id)
  const state = taskState(task, today)
  const done = task.subtasks.filter((entry) => entry.isCompleted).length
  return (
    <li className="flex flex-col">
      <div className="flex items-start gap-1">
        {task.subtasks.length > 0 ? (
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? "Hide" : "Show"} the subtasks of ${task.content}`}
            className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-outline hover:bg-surface-container-high hover:text-on-surface"
          >
            <ChevronDown size={14} className={`transition-transform ${isOpen ? "" : "-rotate-90"}`} aria-hidden="true" />
          </button>
        ) : (
          <CornerDownRight size={13} className="ml-1.5 mr-1 mt-3 shrink-0 text-outline/70" aria-hidden="true" />
        )}
        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 py-2 pr-1">
          <input
            type="checkbox"
            checked={task.isCompleted}
            onChange={(event) => onToggle(task, event.target.checked)}
            disabled={isPending}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className={`mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 ${boxStyles[state]}`}
          >
            {state === "overdue" ? <XCircle size={12} aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={`block whitespace-pre-wrap break-words text-[12.5px] leading-relaxed ${
                task.isCompleted ? "text-outline line-through" : state === "overdue" ? "text-on-error-container" : "text-on-surface"
              }`}
            >
              {task.content}
              {task.subtasks.length > 0 && (
                <span className="ml-2 text-[11px] font-semibold text-outline no-underline">
                  {done} of {task.subtasks.length}
                </span>
              )}
            </span>
            <TaskDetailsView description={task.description} images={task.images} label={task.content} />
          </span>
        </label>
        <RowActions task={task} depth={depth} isPending={isPending} onOpenTask={onOpenTask} />
        {isPending ? (
          <span className="p-2.5" aria-hidden="true">
            <Loader2 size={15} className="animate-spin text-outline" />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onDelete(task)}
            aria-label={`Delete: ${task.content}`}
            className="mt-1 shrink-0 rounded-lg p-2 text-outline transition-colors hover:bg-error/10 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        )}
      </div>
      {isOpen && task.subtasks.length > 0 && <SubtaskTree {...{ depth: depth + 1, today, pendingIds, onToggle, onDelete, onOpenTask }} tasks={task.subtasks} />}
    </li>
  )
}

/**
 * A task's subtasks, indented under it with a line down their left, each with theirs under it: three
 * levels at most. It sits inside the task's row but is not part of the drag area, so pressing,
 * selecting or ticking in here never picks the task up; the task and everything under it move
 * together when the task's own line is dragged. The top level can be folded away.
 */
const SubtaskTree: React.FC<SubtaskTreeProps> = (props) => {
  const [isOpen, setIsOpen] = useState(true)
  const { tasks, depth } = props
  const done = tasks.filter((task) => task.isCompleted).length
  const stop = (event: React.SyntheticEvent) => event.stopPropagation()
  return (
    <div onPointerDown={stop} onMouseDown={stop} onTouchStart={stop} className={`cursor-default ${depth === 2 ? "mb-2 ml-9 mr-2" : "ml-6"}`}>
      {depth === 2 && (
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
          className="mb-0.5 inline-flex items-center gap-1 rounded-md px-1 py-1 text-[11px] font-semibold text-outline hover:bg-surface-container-high hover:text-on-surface"
        >
          <ChevronDown size={13} className={`transition-transform ${isOpen ? "" : "-rotate-90"}`} aria-hidden="true" />
          {tasks.length} {tasks.length === 1 ? "subtask" : "subtasks"}, {done} done
        </button>
      )}
      {isOpen && (
        <ul className="flex flex-col border-l-2 border-outline-variant/70 pl-1.5" aria-label={depth === 2 ? "Subtasks" : "Sub-subtasks"}>
          {tasks.map((task) => (
            <SubtaskItem key={task.id} {...props} task={task} />
          ))}
        </ul>
      )}
    </div>
  )
}

const handleClass =
  "mt-2 ml-1 flex h-8 w-6 shrink-0 touch-none items-center justify-center rounded-md text-outline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"

/**
 * One task in its day, draggable by its handle. While it is being dragged its place stays as a
 * faint outline, so the list never jumps; the copy under the pointer is drawn by the overlay.
 */
const SortableTaskRow = memo(function SortableTaskRow({
  task,
  today,
  isPending,
  isSelected,
  onToggle,
  onDelete,
  onOpenTask,
  onMoveToToday,
  onSelect,
  wasDragging,
  pendingIds,
}: {
  task: DailyTask
  today: string
  isPending: boolean
  isSelected: boolean
  onToggle: (task: DailyTask, isCompleted: boolean) => void
  onDelete: (task: DailyTask) => void
  onOpenTask: (task: DailyTask, focusSubtask?: boolean) => void
  onMoveToToday: (task: DailyTask) => void
  onSelect: (task: DailyTask, mode: SelectMode) => void
  wasDragging: () => boolean
  pendingIds: ReadonlySet<string>
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: isPending,
  })
  const state = taskState(task, today)

  return (
    <li
      ref={setNodeRef}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform), transition, touchAction: "manipulation" }}
      className={`relative flex flex-col rounded-xl border ${isPending ? "" : "cursor-grab active:cursor-grabbing"} ${
        isDragging
          ? "border-dashed border-primary/40 bg-primary-fixed/20 [&>*]:opacity-0"
          : `transition-colors ${stateStyles[state]} ${isSelected ? "ring-2 ring-primary/50 ring-offset-1" : ""}`
      }`}
    >
      <div className="flex items-start gap-1 pr-1">
        <TaskRowBody
          task={task}
          today={today}
          isPending={isPending}
          isSelected={isSelected}
          onToggle={onToggle}
          onDelete={onDelete}
          onOpenTask={onOpenTask}
          onMoveToToday={onMoveToToday}
          onSelect={onSelect}
          wasDragging={wasDragging}
          handle={
            // The whole row drags with a pointer; this is what the keyboard uses, and what says so
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              onKeyDown={listeners?.onKeyDown as React.KeyboardEventHandler<HTMLButtonElement> | undefined}
              aria-label={isSelected ? `Move the picked tasks, starting with: ${task.content}` : `Move task: ${task.content}`}
              className={`${handleClass} ${isPending ? "cursor-not-allowed opacity-40" : "cursor-grab hover:bg-surface-container-high hover:text-on-surface active:cursor-grabbing"}`}
            >
              <GripVertical size={16} aria-hidden="true" />
            </button>
          }
        />
      </div>
      {task.subtasks.length > 0 && (
        <SubtaskTree
          tasks={task.subtasks}
          depth={2}
          today={today}
          pendingIds={pendingIds}
          onToggle={onToggle}
          onDelete={onDelete}
          onOpenTask={onOpenTask}
        />
      )}
    </li>
  )
})

/**
 * Adds one more task to a day already on the list. Enter saves it and keeps the row open for the
 * next one, so a forgotten task takes one click and a line of typing.
 */
const AddToDayRow: React.FC<{ date: string; onAddTask: AddTaskHandler }> = ({ date, onAddTask }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [content, setContent] = useState("")
  const [details, setDetails] = useState<TaskDetailsDraft>(emptyTaskDetails())
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const save = async () => {
    if (isSaving || !content.trim()) return
    setIsSaving(true)
    const added = await onAddTask(date, content.trim(), details)
    setIsSaving(false)
    if (added) {
      setContent("")
      setDetails(emptyTaskDetails())
      setDetailsError(null)
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Plus size={14} aria-hidden="true" />
        Add task to this day
      </button>
    )
  }

  return (
    // The row closes itself when it is left with nothing in it. That is watched on the whole row
    // rather than on the input, so opening the details area, or clicking into the description,
    // does not count as leaving
    <div
      className="mt-1.5 flex flex-col gap-1"
      onBlur={(event) => {
        if (isSaving || content.trim() || hasTaskDetails(details)) return
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOpen(false)
      }}
    >
      <div className="flex items-center gap-2">
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
              setDetails(emptyTaskDetails())
              setIsOpen(false)
            }
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
      </div>
      <TaskDetailsFields
        idPrefix={`add-${date}`}
        details={details}
        onChange={setDetails}
        onError={setDetailsError}
        disabled={isSaving}
      />
      {detailsError && (
        <p role="alert" className="text-[11px] text-error">
          {detailsError}
        </p>
      )}
    </div>
  )
}

/**
 * One day: its heading, how much of it is done, its tasks in their order, and a row for adding
 * one more. The task list is also a drop zone, so a task can be dropped into a day with none.
 */
const DayGroup = memo(function DayGroup({
  day,
  today,
  pendingIds,
  selectedIds,
  isDragging,
  isOverDay,
  onToggle,
  onDelete,
  onOpenTask,
  onMoveToToday,
  onSelect,
  onAddTask,
  wasDragging,
}: {
  day: DailyTaskDay
  today: string
  pendingIds: ReadonlySet<string>
  selectedIds: ReadonlySet<string>
  isDragging: boolean
  // The day the pointer is over, which is where a drop would land
  isOverDay: boolean
  onToggle: (task: DailyTask, isCompleted: boolean) => void
  onDelete: (task: DailyTask) => void
  onOpenTask: (task: DailyTask, focusSubtask?: boolean) => void
  onMoveToToday: (task: DailyTask) => void
  onSelect: (task: DailyTask, mode: SelectMode) => void
  onAddTask: AddTaskHandler
  wasDragging: () => boolean
}) {
  const { title, detail } = dayLabel(day.date, today)
  const done = day.tasks.filter((task) => task.isCompleted).length
  const overdue = day.tasks.some((task) => !task.isCompleted && task.taskDate < today)
  const { setNodeRef } = useDroppable({ id: dayZoneId(day.date) })
  const taskIds = useMemo(() => day.tasks.map((task) => task.id), [day.tasks])
  const isOver = isDragging && isOverDay

  return (
    <li>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="flex items-center gap-2 text-[13px] font-bold text-on-surface">
          {title}
          {detail && <span className="text-[11px] font-medium text-outline">{detail}</span>}
          {overdue && <AlertTriangle size={13} className="text-error" aria-label="Has overdue tasks" />}
        </h3>
        <span className={`text-[11px] font-semibold ${day.tasks.length > 0 && done === day.tasks.length ? "text-success" : "text-outline"}`}>
          {day.tasks.length === 0 ? "No tasks yet" : `${done} of ${day.tasks.length} done`}
        </span>
      </div>
      <SortableContext id={dayZoneId(day.date)} items={taskIds} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          aria-label={`Tasks for ${title}`}
          className={`space-y-1.5 rounded-xl transition-colors ${
            day.tasks.length === 0 ? `flex min-h-[48px] items-center justify-center border border-dashed ${isOver ? "border-primary bg-primary-fixed/30" : "border-outline-variant"}` : ""
          } ${isDragging && isOver && day.tasks.length > 0 ? "bg-primary-fixed/25 outline outline-2 outline-offset-4 outline-primary/40" : ""}`}
        >
          {day.tasks.length === 0 ? (
            <li className="px-3 text-[12px] text-outline">{isDragging ? "Drop here" : "Drag a task here, or add one below"}</li>
          ) : (
            day.tasks.map((task) => (
              <SortableTaskRow
                key={task.id}
                task={task}
                today={today}
                isPending={pendingIds.has(task.id)}
                isSelected={selectedIds.has(task.id)}
                onToggle={onToggle}
                onDelete={onDelete}
                onOpenTask={onOpenTask}
                onMoveToToday={onMoveToToday}
                onSelect={onSelect}
                wasDragging={wasDragging}
                pendingIds={pendingIds}
              />
            ))
          )}
        </ul>
      </SortableContext>
      <AddToDayRow date={day.date} onAddTask={onAddTask} />
    </li>
  )
})

/**
 * The task list: the last seven days first, then older days a week at a time. Each day keeps its
 * own heading, so the order stays readable across pages. Any task can be dragged by its handle to
 * another place in its day, or into another day on the page (today is always there to drop on);
 * the page is told once, on the drop, and saves it.
 *
 * **The whole row is the handle.** A mouse drags a row from anywhere on it (the circle, the tick box
 * and the bin stop the drag, so they still do their own job), a touch presses and holds first so the
 * page can still be scrolled, and the grip is the keyboard's way in.
 *
 * **Several tasks move together.** Click the circle on each one (Shift click picks everything in
 * between, across days as well as within one) and drag any of them: the rest leave their places at
 * once and land together where that one is dropped, keeping the order they had on the page. Dragging
 * a task nobody picked moves that one alone and drops the picking, so what will move is never in doubt.
 *
 * **The list never rearranges itself under the pointer while a task crosses days.** The day being
 * dropped into is lit up instead, and the move is worked out once, on the drop: a list that reflowed
 * mid-drag moved the pointer's target, which moved the list again, until React gave up (error #185).
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
  onOpenTask,
  onMoveToToday,
  onDeletePicked,
  onMove,
  onAddTask,
}) => {
  const current = page?.page ?? 1
  const pageCount = page?.pageCount ?? 1
  const hasDays = (page?.days.length ?? 0) > 0
  const dndId = useId()

  // The days as they stand for this drag, taken once at the start and never changed while it runs
  const [dragDays, setDragDays] = useState<DailyTaskDay[] | null>(null)
  const [activeTask, setActiveTask] = useState<DailyTask | null>(null)
  // The day under the pointer, which is only ever lit up: it moves nothing, so nothing can loop
  const [overDate, setOverDate] = useState<string | null>(null)
  // Where the dragged task started, so a drop back in the same place saves nothing
  const origin = useRef<{ date: string; index: number } | null>(null)
  // A click that only finished a drag is not a click on the task under it
  const draggedAt = useRef(0)
  const wasDragging = useCallback(() => Date.now() - draggedAt.current < 250, [])
  // The tasks picked to move together
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  // The last task picked, which a Shift click reaches back to
  const lastPicked = useRef<string | null>(null)
  // Every task on the page, top to bottom, for Shift picking and for the order a group lands in
  const rowsInOrder = useRef<DailyTask[]>([])
  // What is travelling with the pointer: one task, or every picked one, and how many that is
  const moving = useRef<DailyTask[]>([])
  const [movingCount, setMovingCount] = useState(0)

  // Today is always a place to drop on, on the page that shows it, even before it has a task
  const days = useMemo(() => {
    const shown = dragDays ?? page?.days ?? []
    if (!page || current !== 1 || !today || shown.length === 0 || shown.some((day) => day.date === today)) return shown
    return [{ date: today, tasks: [] }, ...shown]
  }, [dragDays, page, current, today])

  // The rows as the page shows them, kept for a Shift pick and for the order a group lands in. It is
  // read only when something is clicked or dragged, so it is put in the ref after the list is drawn
  useEffect(() => {
    rowsInOrder.current = days.flatMap((day) => day.tasks)
  }, [days])

  // A picked task that has gone (deleted, or off this page) simply stops counting as picked. It is
  // dropped here rather than in an effect, so nothing is picked that isn't on screen
  const onPage = useMemo(() => new Set((page?.days ?? []).flatMap((day) => day.tasks.map((task) => task.id))), [page])
  const selectedIds = useMemo(() => new Set([...selected].filter((id) => onPage.has(id))), [selected, onPage])

  const clearSelection = useCallback(() => {
    setSelected(new Set())
    lastPicked.current = null
  }, [])

  const selectTask = useCallback((task: DailyTask, mode: SelectMode) => {
    // Both ends of the range are read here, not inside the updater: React runs an updater after
    // this function has returned, by which time `lastPicked` is already the task just clicked
    const ids = rowsInOrder.current.map((entry) => entry.id)
    const from = lastPicked.current ? ids.indexOf(lastPicked.current) : -1
    const to = ids.indexOf(task.id)
    setSelected((current) => {
      const next = new Set(current)
      if (mode === "range" && from >= 0 && to >= 0) {
        for (const id of ids.slice(Math.min(from, to), Math.max(from, to) + 1)) next.add(id)
      } else if (next.has(task.id)) {
        next.delete(task.id)
      } else {
        next.add(task.id)
      }
      return next
    })
    lastPicked.current = task.id
  }, [])

  const sensors = useSensors(
    // A few pixels of movement before a drag starts, so clicking a row still ticks or picks it
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // A touch presses and holds first, so the page can still be scrolled with a finger on a row
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const taskById = (id: UniqueIdentifier) => days.flatMap((day) => day.tasks).find((task) => task.id === String(id))
  const describe = (id: UniqueIdentifier) => {
    const date = dateOf(days, id)
    return `"${taskById(id)?.content ?? "task"}"${date ? ` on ${dayLabel(date, today).title}` : ""}`
  }
  // Where a drop would land now: the task it is over, in the day it is over
  const landingOn = (id: UniqueIdentifier) => {
    const date = dateOf(days, id)
    const day = days.find((entry) => entry.date === date)
    const at = day ? day.tasks.findIndex((task) => task.id === String(id)) + 1 : 0
    return `${date ? dayLabel(date, today).title : "no day"}${at > 0 ? `, position ${at}` : ""}`
  }
  // While several are moving they are announced as a group, since they all land in one place
  const moved = (id: UniqueIdentifier) => (moving.current.length > 1 ? `${moving.current.length} picked tasks` : describe(id))
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${moved(active.id)}. Use the arrow keys to move ${moving.current.length > 1 ? "them" : "it"}, Space to drop, Escape to cancel.`,
    onDragOver: ({ active, over }) => (over ? `${moved(active.id)} over ${landingOn(over.id)}.` : "Not over a day."),
    onDragEnd: ({ active }) => `Dropped ${moved(active.id)}.`,
    onDragCancel: ({ active }) => `Moving cancelled. ${moved(active.id)} back where it was.`,
  }

  const handleDragStart = ({ active }: DragStartEvent) => {
    const activeId = String(active.id)
    const dragged = taskById(active.id) ?? null
    // Dragging a task nobody picked moves that one, and the picking goes with it
    const isGroup = selectedIds.has(activeId) && selectedIds.size > 1
    if (!isGroup && selectedIds.size > 0) clearSelection()
    // A task still being saved keeps its place rather than travelling with a stale order
    const group = isGroup
      ? rowsInOrder.current.filter((task) => task.id === activeId || (selectedIds.has(task.id) && !pendingIds.has(task.id)))
      : dragged
        ? [dragged]
        : []
    moving.current = group
    setMovingCount(group.length)
    const passengers = new Set(group.filter((task) => task.id !== activeId).map((task) => task.id))

    // The tasks coming along leave their places at once, so the days show where the group will land
    const startDays = days.map((day) => ({ ...day, tasks: day.tasks.filter((task) => !passengers.has(task.id)) }))
    const date = dateOf(startDays, active.id)
    const day = startDays.find((entry) => entry.date === date)
    origin.current = date && day ? { date, index: day.tasks.findIndex((task) => task.id === activeId) } : null
    setActiveTask(dragged)
    setOverDate(date)
    setDragDays(startDays)
  }

  // Only the lit-up day changes as the pointer travels. Nothing is reordered here, because a list
  // that reflows under the pointer moves what the pointer is over, which reflows it again
  const handleDragOver = ({ over }: DragOverEvent) => {
    setOverDate((currentDate) => {
      const next = over ? dateOf(dragDays ?? [], over.id) : null
      return next === currentDate ? currentDate : next
    })
  }

  const finishDrag = () => {
    if (activeTask) draggedAt.current = Date.now()
    setDragDays(null)
    setActiveTask(null)
    setOverDate(null)
    origin.current = null
    moving.current = []
    setMovingCount(0)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const start = origin.current
    const dragged = activeTask
    const group = moving.current.length > 0 ? moving.current : dragged ? [dragged] : []
    const toDate = over && dragDays ? dateOf(dragDays, over.id) : null
    if (!over || !dragDays || !start || !dragged || !toDate) {
      finishDrag()
      return
    }

    const activeId = String(active.id)
    // The whole move is worked out here, from the days as they were when the drag began
    const without = dragDays.map((day) => ({ ...day, tasks: day.tasks.filter((task) => task.id !== activeId) }))
    // Where it was dropped is read from the day as it stood, so within a day the place it lands is
    // the one the list showed: taken out first, it goes back in at that same index
    const overIndex = dragDays.find((day) => day.date === toDate)?.tasks.findIndex((task) => task.id === String(over.id)) ?? -1
    let index: number
    if (overIndex < 0) {
      // Dropped on the day itself rather than on a task: it goes to the end of that day
      index = without.find((day) => day.date === toDate)?.tasks.length ?? 0
    } else if (toDate === start.date) {
      // The same day reorders exactly as the list showed it while dragging
      index = overIndex
    } else {
      // Another day takes it above or below the task it was dropped on, by where the pointer is
      const pointerTop = active.rect.current.translated?.top ?? 0
      index = overIndex + (pointerTop > over.rect.top + over.rect.height / 2 ? 1 : 0)
    }

    // One task dropped back where it started saves nothing; a group always has others to put back
    if (group.length === 1 && toDate === start.date && index === start.index) {
      finishDrag()
      return
    }

    // Everyone that travelled lands together, in the order they had on the page
    const landed = group.map((task) => ({ ...task, taskDate: toDate }))
    const days = without.map((day) =>
      day.date === toDate ? { ...day, tasks: [...day.tasks.slice(0, index), ...landed, ...day.tasks.slice(index)] } : day
    )
    const landedDay = days.find((day) => day.date === toDate)
    // The page is told the tasks as they were, so it can work out what left an overdue or an older day
    onMove({ tasks: group, dragged, toDate, orderedIds: landedDay?.tasks.map((task) => task.id) ?? [], days })
    clearSelection()
    finishDrag()
  }

  return (
    <section
      aria-label="Your tasks"
      className="flex min-h-[320px] flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm lg:min-h-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-on-surface">{current === 1 ? `Last ${VISIBLE_DAYS} Days` : "Older Tasks"}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {page && (
            <span className="text-[11px] text-outline">
              {current === 1 ? `From ${page.windowStart}` : `Page ${current} of ${pageCount}`}
            </span>
          )}
        </div>
      </div>

      {/* One line that says how to move one task and how to move several */}
      {hasDays && !error && (
        <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-primary/25 bg-primary-fixed/20 px-3 py-2 text-[12px] text-on-surface">
          <span>
            <CheckCheck size={13} className="mr-1.5 inline-block align-[-2px] text-primary" aria-hidden="true" />
            Drag any row to move it, even to another day. Click circles to move several at once.
          </span>
          {selectedIds.size > 0 && (
            <span role="status" className="flex shrink-0 items-center gap-2 font-semibold">
              {selectedIds.size} picked
              <button
                type="button"
                onClick={() => onDeletePicked([...selectedIds])}
                className="inline-flex items-center gap-1 rounded-md border border-error/40 px-2 py-0.5 text-error hover:bg-error/5"
              >
                <Trash2 size={12} aria-hidden="true" />
                Delete
              </button>
              <button type="button" onClick={clearSelection} className="text-primary hover:underline">
                Clear
              </button>
            </span>
          )}
        </p>
      )}

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
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCorners}
          modifiers={[restrictToVerticalAxis]}
          accessibility={{ announcements }}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={finishDrag}
        >
          <ul aria-busy={isLoading} className="custom-scrollbar flex-1 space-y-4 overflow-y-auto pr-1">
            {days.map((day) => (
              <DayGroup
                key={day.date}
                day={day}
                today={today}
                pendingIds={pendingIds}
                selectedIds={selectedIds}
                isDragging={activeTask !== null}
                isOverDay={overDate === day.date}
                onToggle={onToggle}
                onDelete={onDelete}
                onOpenTask={onOpenTask}
                onMoveToToday={onMoveToToday}
                onSelect={selectTask}
                onAddTask={onAddTask}
                wasDragging={wasDragging}
              />
            ))}
          </ul>
          <DragOverlay dropAnimation={DROP_ANIMATION}>
            {activeTask ? (
              <div className="relative">
                <div
                  className={`flex cursor-grabbing items-start gap-1 rounded-xl border pr-1 shadow-xl ring-2 ring-primary/30 ${
                    stateStyles[taskState({ ...activeTask, taskDate: overDate ?? activeTask.taskDate }, today)]
                  } bg-white`}
                >
                  <TaskRowBody
                    task={{ ...activeTask, taskDate: overDate ?? activeTask.taskDate }}
                    today={today}
                    isPending={false}
                    handle={
                      <span className={`${handleClass} bg-surface-container-high text-on-surface`} aria-hidden="true">
                        <GripVertical size={16} />
                      </span>
                    }
                  />
                </div>
                {movingCount > 1 && (
                  <span className="absolute -right-2 -top-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white shadow-lg">
                    +{movingCount - 1} more
                  </span>
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
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
