"use client"

import React, { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
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
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { CSS } from "@dnd-kit/utilities"
import {
  AlertTriangle,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  GripVertical,
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
  onMove: (move: TaskMove) => void
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
  handle: React.ReactNode
  // Picking tasks to move together: the box is shown while picking, and Ctrl/Cmd or Shift click picks too
  isSelected?: boolean
  isPicking?: boolean
  onSelect?: (task: DailyTask, mode: SelectMode) => void
}

/**
 * What a task shows: the drag handle, a box for picking it when several are being moved, a checkbox
 * with its text, and a delete button. The label covers only the checkbox and the text, so neither
 * deleting, dragging nor picking ever ticks it by accident: a Ctrl (or Cmd) click picks the task
 * instead of ticking it, and a Shift click picks everything between it and the last one picked.
 * Without handlers it is the copy that follows the pointer during a drag.
 */
const TaskRowBody: React.FC<TaskRowBodyProps> = ({
  task,
  today,
  isPending,
  onToggle,
  onDelete,
  handle,
  isSelected = false,
  isPicking = false,
  onSelect,
}) => {
  const state = taskState(task, today)
  return (
    <>
      {handle}
      {isPicking && onSelect && (
        <span className="flex items-center self-stretch py-3 pl-0.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(task, "toggle")}
            onClick={(event) => {
              if (event.shiftKey) onSelect(task, "range")
            }}
            aria-label={`Pick "${task.content}" to move with others`}
            title="Pick this task, then drag any picked task to move them all"
            className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
          />
        </span>
      )}
      <label
        onClick={(event) => {
          if (!onSelect) return
          if (event.shiftKey) {
            event.preventDefault()
            onSelect(task, "range")
          } else if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            onSelect(task, "toggle")
          }
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
      ) : onDelete ? (
        <button
          type="button"
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
  isPicking,
  onToggle,
  onDelete,
  onSelect,
}: {
  task: DailyTask
  today: string
  isPending: boolean
  isSelected: boolean
  isPicking: boolean
  onToggle: (task: DailyTask, isCompleted: boolean) => void
  onDelete: (task: DailyTask) => void
  onSelect: (task: DailyTask, mode: SelectMode) => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: isPending,
  })
  const state = taskState(task, today)

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative flex items-start gap-1 rounded-xl border pr-1 ${
        isDragging
          ? "border-dashed border-primary/40 bg-primary-fixed/20 [&>*]:opacity-0"
          : `transition-colors ${stateStyles[state]} ${isSelected ? "ring-2 ring-primary/50 ring-offset-1" : ""}`
      }`}
    >
      <TaskRowBody
        task={task}
        today={today}
        isPending={isPending}
        isSelected={isSelected}
        isPicking={isPicking}
        onToggle={onToggle}
        onDelete={onDelete}
        onSelect={onSelect}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={isSelected ? `Move the picked tasks, starting with: ${task.content}` : `Move task: ${task.content}`}
            className={`${handleClass} ${isPending ? "cursor-not-allowed opacity-40" : "cursor-grab hover:bg-surface-container-high hover:text-on-surface active:cursor-grabbing"}`}
          >
            <GripVertical size={16} aria-hidden="true" />
          </button>
        }
      />
    </li>
  )
})

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
    <div className="mt-1.5 flex items-center gap-2">
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
  isPicking,
  isDragging,
  onToggle,
  onDelete,
  onSelect,
  onAddTask,
}: {
  day: DailyTaskDay
  today: string
  pendingIds: ReadonlySet<string>
  selectedIds: ReadonlySet<string>
  isPicking: boolean
  isDragging: boolean
  onToggle: (task: DailyTask, isCompleted: boolean) => void
  onDelete: (task: DailyTask) => void
  onSelect: (task: DailyTask, mode: SelectMode) => void
  onAddTask: (date: string, content: string) => Promise<boolean>
}) {
  const { title, detail } = dayLabel(day.date, today)
  const done = day.tasks.filter((task) => task.isCompleted).length
  const overdue = day.tasks.some((task) => !task.isCompleted && task.taskDate < today)
  const { setNodeRef, isOver } = useDroppable({ id: dayZoneId(day.date) })
  const taskIds = useMemo(() => day.tasks.map((task) => task.id), [day.tasks])

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
          } ${isDragging && isOver && day.tasks.length > 0 ? "bg-primary-fixed/15 outline outline-2 outline-offset-4 outline-primary/20" : ""}`}
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
                isPicking={isPicking}
                onToggle={onToggle}
                onDelete={onDelete}
                onSelect={onSelect}
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
 * **Several tasks move together.** Pick them (the boxes under "Pick several", or a Ctrl/Cmd click on
 * a task, or a Shift click for everything in between, across days as well as within one) and drag
 * any one of them: the rest leave their places at once and land together where that one is dropped,
 * keeping the order they had on the page. Dragging a task that was not picked moves that one alone
 * and drops the picking, so what is about to move is never in doubt.
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
  onMove,
  onAddTask,
}) => {
  const current = page?.page ?? 1
  const pageCount = page?.pageCount ?? 1
  const hasDays = (page?.days.length ?? 0) > 0
  const dndId = useId()

  // The days as they look while a task is being dragged; null when nothing is
  const [dragDays, setDragDays] = useState<DailyTaskDay[] | null>(null)
  const [activeTask, setActiveTask] = useState<DailyTask | null>(null)
  // Where the dragged task started, so a drop back in the same place saves nothing
  const origin = useRef<{ date: string; index: number } | null>(null)
  // The tasks picked to move together, and whether the picking boxes are on show
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [isPicking, setIsPicking] = useState(false)
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
    setIsPicking(true)
    setSelected((current) => {
      const next = new Set(current)
      const ids = rowsInOrder.current.map((entry) => entry.id)
      const from = lastPicked.current ? ids.indexOf(lastPicked.current) : -1
      const to = ids.indexOf(task.id)
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

  const stopPicking = () => {
    setIsPicking(false)
    clearSelection()
  }

  const sensors = useSensors(
    // A few pixels of movement before a drag starts, so pressing the handle to focus it is not a drag
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const taskById = (id: UniqueIdentifier) => days.flatMap((day) => day.tasks).find((task) => task.id === String(id))
  const describe = (id: UniqueIdentifier) => {
    const date = dateOf(days, id)
    return `"${taskById(id)?.content ?? "task"}"${date ? ` on ${dayLabel(date, today).title}` : ""}`
  }
  const positionIn = (id: UniqueIdentifier) => {
    const date = dateOf(days, id)
    const day = days.find((entry) => entry.date === date)
    return day ? day.tasks.findIndex((task) => task.id === String(id)) + 1 : 0
  }
  // While several are moving they are announced as a group, since they all land in one place
  const moved = (id: UniqueIdentifier) => (moving.current.length > 1 ? `${moving.current.length} picked tasks` : describe(id))
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${moved(active.id)}. Use the arrow keys to move ${moving.current.length > 1 ? "them" : "it"}, Space to drop, Escape to cancel.`,
    onDragOver: ({ active, over }) => (over ? `${moved(active.id)} now at position ${positionIn(active.id)}.` : "Not over a day."),
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
    setDragDays(startDays)
  }

  // Crossing into another day moves the task there at once, so the days make room as it travels
  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    setDragDays((currentDays) => {
      if (!currentDays) return currentDays
      const fromDate = dateOf(currentDays, active.id)
      const toDate = dateOf(currentDays, over.id)
      if (!fromDate || !toDate || fromDate === toDate) return currentDays

      const fromDay = currentDays.find((day) => day.date === fromDate)
      const toDay = currentDays.find((day) => day.date === toDate)
      const moving = fromDay?.tasks.find((task) => task.id === String(active.id))
      if (!fromDay || !toDay || !moving) return currentDays

      const overIndex = toDay.tasks.findIndex((task) => task.id === String(over.id))
      const pointerTop = active.rect.current.translated?.top ?? 0
      const isBelowOver = overIndex >= 0 && pointerTop > over.rect.top + over.rect.height / 2
      const insertAt = overIndex >= 0 ? overIndex + (isBelowOver ? 1 : 0) : toDay.tasks.length

      return currentDays.map((day) => {
        if (day.date === fromDate) return { ...day, tasks: day.tasks.filter((task) => task.id !== moving.id) }
        if (day.date === toDate) {
          const tasks = [...day.tasks]
          tasks.splice(insertAt, 0, { ...moving, taskDate: toDate })
          return { ...day, tasks }
        }
        return day
      })
    })
  }

  const finishDrag = () => {
    setDragDays(null)
    setActiveTask(null)
    origin.current = null
    moving.current = []
    setMovingCount(0)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const start = origin.current
    const dragged = activeTask
    const group = moving.current.length > 0 ? moving.current : dragged ? [dragged] : []
    if (!over || !dragDays || !start || !dragged) {
      finishDrag()
      return
    }

    // Within the day it ended up in, the last reorder happens on the drop
    const toDate = dateOf(dragDays, active.id)
    const finalDays = dragDays.map((day) => {
      if (day.date !== toDate) return day
      const from = day.tasks.findIndex((task) => task.id === String(active.id))
      const to = day.tasks.findIndex((task) => task.id === String(over.id))
      return from >= 0 && to >= 0 && from !== to ? { ...day, tasks: arrayMove(day.tasks, from, to) } : day
    })
    const toDay = finalDays.find((day) => day.date === toDate)
    const index = toDay?.tasks.findIndex((task) => task.id === String(active.id)) ?? -1
    // One task dropped back where it started saves nothing; a group always has others to put back
    const isSamePlace = group.length === 1 && toDate === start.date && index === start.index

    if (toDate && toDay && index >= 0 && !isSamePlace) {
      // Everyone that travelled lands together, in the order they had on the page
      const landed = group.map((task) => ({ ...task, taskDate: toDate }))
      const days = finalDays.map((day) => {
        if (day.date !== toDate) return day
        const tasks = [...day.tasks]
        tasks.splice(index, 1, ...landed)
        return { ...day, tasks }
      })
      const landedDay = days.find((day) => day.date === toDate)
      // The page is told the tasks as they were, so it can work out what left an overdue or an older day
      onMove({ tasks: group, dragged, toDate, orderedIds: landedDay?.tasks.map((task) => task.id) ?? [], days })
    }
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
          {hasDays && !error && (
            <button
              type="button"
              onClick={() => (isPicking ? stopPicking() : setIsPicking(true))}
              aria-pressed={isPicking}
              title="Pick several tasks and drag them to another day together. Ctrl (or Cmd) click a task picks it too, Shift click picks everything in between."
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                isPicking
                  ? "border-primary bg-primary text-white hover:bg-on-primary-fixed-variant"
                  : "border-outline-variant bg-white text-on-surface-variant hover:border-primary/40 hover:text-primary"
              }`}
            >
              <CheckSquare size={13} aria-hidden="true" />
              {isPicking ? "Done picking" : "Pick several"}
            </button>
          )}
        </div>
      </div>

      {(isPicking || selectedIds.size > 0) && !error && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-primary/30 bg-primary-fixed/25 px-3 py-2 text-[12px] text-on-surface"
        >
          <span>
            {selectedIds.size === 0
              ? "Tick the box beside every task you want to move, then drag any one of them."
              : `${selectedIds.size} task${selectedIds.size === 1 ? "" : "s"} picked. Drag any one of them to move them all to another day.`}
          </span>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button type="button" onClick={clearSelection} className="font-semibold text-primary hover:underline">
                Clear
              </button>
            )}
            <button type="button" onClick={stopPicking} className="font-semibold text-on-surface-variant hover:underline">
              Done
            </button>
          </div>
        </div>
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
                isPicking={isPicking}
                isDragging={activeTask !== null}
                onToggle={onToggle}
                onDelete={onDelete}
                onSelect={selectTask}
                onAddTask={onAddTask}
              />
            ))}
          </ul>
          <DragOverlay dropAnimation={DROP_ANIMATION}>
            {activeTask ? (
              <div className="relative">
                <div
                  className={`flex cursor-grabbing items-start gap-1 rounded-xl border pr-1 shadow-xl ring-2 ring-primary/30 ${
                    stateStyles[taskState({ ...activeTask, taskDate: dateOf(days, activeTask.id) ?? activeTask.taskDate }, today)]
                  } bg-white`}
                >
                  <TaskRowBody
                    task={{ ...activeTask, taskDate: dateOf(days, activeTask.id) ?? activeTask.taskDate }}
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
