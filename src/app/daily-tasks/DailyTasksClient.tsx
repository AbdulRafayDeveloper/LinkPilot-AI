"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, CalendarArrowUp, ListTodo, Loader2, Trash2 } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { TaskComposer, emptyRows, type TaskRow } from "@/components/daily-tasks/TaskComposer"
import { ConfirmBulkDelete } from "@/components/ui/BulkDelete"
import { TaskDayList, type TaskMove } from "@/components/daily-tasks/TaskDayList"
import { CleanupOldTasksDialog } from "@/components/daily-tasks/CleanupOldTasksDialog"
import { TaskEditorDialog } from "@/components/daily-tasks/TaskEditorDialog"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { createToolStore, useToolStore } from "@/lib/toolStore"
import { requestApi } from "@/lib/apiClient"
import { todayIso } from "@/lib/taskDates"
import { completedLastNested, pathTo, removeNested, updateNested } from "@/lib/taskTree"
import { DAILY_TASKS_ENDPOINT, DAILY_TASKS_MESSAGES, VISIBLE_DAYS } from "@/constants/dailyTasks"
import { TASK_ATTACHMENT_MESSAGES } from "@/constants/taskAttachments"
import type { DailyTask, DailyTaskDay, DailyTasksPage } from "@/types/dailyTasks"
import { toStoredImages, type TaskDetailsDraft } from "@/types/taskAttachment"

/**
 * What is half-written survives switching tools, like every other tool's input. The images already
 * uploaded are kept by their ids; one still uploading when the page was left is not (it has no id yet).
 */
const draftStore = createToolStore(
  "daily-tasks:draft",
  { taskDate: "", rows: emptyRows() as TaskRow[] },
  {
    version: 3,
    toStored: (state) => ({
      ...state,
      rows: state.rows.map((row) => ({ ...row, details: { ...row.details, uploading: 0 } })),
    }),
  }
)

// A row with details opened on it is sent with them; a plain line is sent as the string it always was
const rowBody = (content: string, details: TaskDetailsDraft) =>
  details.description.trim() || details.images.length > 0
    ? { content, description: details.description.trim(), images: toStoredImages(details.images) }
    : content

// Every day's tasks with one task changed or taken away, wherever it sits
const changeTask = (days: DailyTaskDay[], id: string, change: (task: DailyTask) => DailyTask) =>
  days.map((day) => ({ ...day, tasks: updateNested(day.tasks, id, change) }))

export default function DailyTasksClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  // The browser's own day, so a task lands on the day the user is living in
  const [today, setToday] = useState("")
  const [page, setPage] = useState<DailyTasksPage | null>(null)
  const [requestedPage, setRequestedPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isMovingOverdue, setIsMovingOverdue] = useState(false)
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set())
  const [taskError, setTaskError] = useState<string | null>(null)
  // The task open in the editor (its details and subtasks), and whether "Add subtask" has the focus
  const [editing, setEditing] = useState<{ id: string; focusSubtask: boolean } | null>(null)
  // The picked tasks waiting to be confirmed for deletion, and whether that delete is running
  const [confirmingPicked, setConfirmingPicked] = useState<string[] | null>(null)
  const [isDeletingPicked, setIsDeletingPicked] = useState(false)
  const [isConfirmingCleanup, setIsConfirmingCleanup] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [cleanupError, setCleanupError] = useState<string | null>(null)
  const { taskDate, rows } = useToolStore(draftStore)
  // Moves are saved one after another, so a second quick drag is checked against the first one's result
  const moveQueue = useRef<Promise<void>>(Promise.resolve())
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()

  // The day is read on arrival and again whenever the tab comes back, so a page left open
  // overnight rolls over to the new day instead of filing tasks under yesterday
  useEffect(() => {
    const readToday = () => setToday((current) => (todayIso() === current ? current : todayIso()))
    readToday()
    const onVisible = () => {
      if (document.visibilityState === "visible") readToday()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", readToday)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", readToday)
    }
  }, [])

  // A fresh draft starts on today, and a date left over from an earlier day never stays ahead of it
  useEffect(() => {
    if (!today) return
    draftStore.update((draft) => (draft.taskDate && draft.taskDate <= today ? draft : { ...draft, taskDate: today }))
  }, [today])

  useEffect(() => {
    if (!today) return
    const controller = new AbortController()
    requestApi<DailyTasksPage>(`${DAILY_TASKS_ENDPOINT}?today=${today}&page=${requestedPage}`, {
      signal: controller.signal,
    })
      .then(({ data }) => {
        setPage(data)
        setLoadError(null)
        // The server clamps the page to what exists, so the controls follow what came back
        if (data.page !== requestedPage) setRequestedPage(data.page)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(error instanceof Error ? error.message : DAILY_TASKS_MESSAGES.loadFailed)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [today, requestedPage, loadAttempt])

  const reload = useCallback(() => {
    setIsLoading(true)
    setLoadAttempt((attempt) => attempt + 1)
  }, [])

  const goToPage = useCallback((next: number) => {
    setIsLoading(true)
    setRequestedPage(next)
  }, [])

  // Back to the newest page, reloading it when that is where the list already is
  const showNewest = useCallback(() => {
    if (requestedPage === 1) reload()
    else goToPage(1)
  }, [requestedPage, reload, goToPage])

  const addTasks = async () => {
    if (isSaving || !today) return
    // A row is sent as its line alone unless details were opened on it, so a plain list of tasks
    // posts exactly the body it always did
    if (rows.some((row) => row.details.uploading > 0)) {
      setSaveError("Wait for the images to finish uploading.")
      return
    }
    const contents = rows
      .map((row) => ({ ...row, content: row.content.trim() }))
      .filter((row) => row.content)
      .map((row) => rowBody(row.content, row.details))
    if (contents.length === 0) {
      setSaveError(DAILY_TASKS_MESSAGES.missingContent)
      return
    }
    setIsSaving(true)
    setSaveError(null)
    setNotice(null)
    try {
      const { data, message } = await requestApi<{ tasks: DailyTask[] }>(DAILY_TASKS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ today, taskDate, contents }),
      }, { idempotent: true })
      const saved = data.tasks.length
      const dropped = contents.length - saved
      const isOlder = page ? taskDate < page.windowStart : false
      draftStore.update({ rows: emptyRows() })
      setNotice(
        [
          message || DAILY_TASKS_MESSAGES.saved,
          dropped > 0 ? `${dropped} repeated ${dropped === 1 ? "row was" : "rows were"} saved once.` : "",
          isOlder ? `That day is older than ${VISIBLE_DAYS} days, so it is on an older page.` : "",
        ]
          .filter(Boolean)
          .join(" ")
      )
      showNewest()
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : DAILY_TASKS_MESSAGES.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  // The checkbox changes on screen at once and is written in the background; a failed write puts
  // the task back the way it was
  const toggleTask = async (task: DailyTask, isCompleted: boolean) => {
    if (pendingIds.has(task.id)) return
    setTaskError(null)
    setPendingIds((current) => new Set(current).add(task.id))
    const applyTask = (updated: DailyTask) =>
      setPage((current) =>
        current
          ? {
              ...current,
              // The task keeps the subtasks the list has, since a tick answers with the task alone,
              // and a ticked task drops to the end of its own list at once, as the next load would show it
              days: changeTask(current.days, updated.id, (entry) => ({ ...updated, subtasks: entry.subtasks })).map((day) => ({
                ...day,
                tasks: completedLastNested(day.tasks),
              })),
              overdueCount:
                updated.taskDate < today
                  ? Math.max(0, current.overdueCount + (updated.isCompleted ? -1 : 1))
                  : current.overdueCount,
            }
          : current
      )

    applyTask({ ...task, isCompleted, completedAt: isCompleted ? new Date().toISOString() : null })
    try {
      const { data } = await requestApi<DailyTask>(`${DAILY_TASKS_ENDPOINT}/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted }),
      })
      applyTask(data)
    } catch (error: unknown) {
      applyTask(task)
      setTaskError(error instanceof Error ? error.message : DAILY_TASKS_MESSAGES.updateFailed)
    } finally {
      setPendingIds((current) => {
        const next = new Set(current)
        next.delete(task.id)
        return next
      })
    }
  }

  // One more task on a day already on the list: it appears in that day, in the order written
  const addTaskToDay = async (date: string, content: string, details?: TaskDetailsDraft): Promise<boolean> => {
    setTaskError(null)
    try {
      const row = details ? rowBody(content, details) : content
      const { data } = await requestApi<{ tasks: DailyTask[] }>(DAILY_TASKS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ today, taskDate: date, contents: [row] }),
      }, { idempotent: true })
      const added = data.tasks[0]
      if (!added) return false
      setPage((current) =>
        current
          ? {
              ...current,
              days: current.days.map((day) => (day.date === date ? { ...day, tasks: [...day.tasks, added] } : day)),
              overdueCount: date < today ? current.overdueCount + 1 : current.overdueCount,
              olderTaskCount: date < current.windowStart ? current.olderTaskCount + 1 : current.olderTaskCount,
            }
          : current
      )
      return true
    } catch (error: unknown) {
      setTaskError(error instanceof Error ? error.message : DAILY_TASKS_MESSAGES.addToDayFailed)
      return false
    }
  }

  /**
   * Tasks dragged to a new place: the one under the pointer, or every task that was picked to travel
   * with it. The page shows them there at once; the move is then saved after any move still being
   * saved. The new order of the day they landed on is what the server is sent, and it says for
   * itself which tasks arrived from another day, so one task and a whole group are the same request.
   * If saving fails the list goes back to how it was and is read again from the server, so it never
   * shows an order the database doesn't have.
   */
  const moveTask = ({ tasks, dragged, toDate, orderedIds, days }: TaskMove) => {
    setTaskError(null)
    const snapshot = page
    const movedIds = tasks.map((entry) => entry.id)
    const stillOpen = tasks.filter((entry) => !entry.isCompleted)
    const overdueChange = stillOpen.reduce((total, entry) => total + Number(toDate < today) - Number(entry.taskDate < today), 0)
    setPendingIds((current) => {
      const next = new Set(current)
      movedIds.forEach((id) => next.add(id))
      return next
    })
    setPage((current) =>
      current
        ? {
            ...current,
            days: days.filter((day) => day.tasks.length > 0),
            overdueCount: Math.max(0, current.overdueCount + overdueChange),
            olderTaskCount: Math.max(
              0,
              current.olderTaskCount +
                tasks.reduce(
                  (total, entry) => total + Number(toDate < current.windowStart) - Number(entry.taskDate < current.windowStart),
                  0
                )
            ),
          }
        : current
    )

    moveQueue.current = moveQueue.current.then(async () => {
      try {
        await requestApi<DailyTask>(`${DAILY_TASKS_ENDPOINT}/${dragged.id}/move`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ today, taskDate: toDate, orderedIds }),
        })
      } catch (error: unknown) {
        setPage(snapshot)
        setTaskError(error instanceof Error ? error.message : DAILY_TASKS_MESSAGES.moveFailed)
        reload()
      } finally {
        setPendingIds((current) => {
          const next = new Set(current)
          movedIds.forEach((id) => next.delete(id))
          return next
        })
      }
    })
  }

  // A task is one line, so it goes on one click and comes back if the delete fails
  /**
   * Deletes every picked task in one call, whatever day each is on. Deleting is final, so it only
   * runs from the confirmation; the list is read again afterwards rather than patched.
   */
  const removePicked = async (ids: string[]) => {
    if (isDeletingPicked) return
    setIsDeletingPicked(true)
    setTaskError(null)
    try {
      await requestApi<{ deleted: number }>(DAILY_TASKS_ENDPOINT, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      setConfirmingPicked(null)
      reload()
    } catch (error: unknown) {
      setTaskError(error instanceof Error ? error.message : DAILY_TASKS_MESSAGES.deleteFailed)
      setConfirmingPicked(null)
    } finally {
      setIsDeletingPicked(false)
    }
  }

  /**
   * A task saved from its editor (which saves as it is typed): the row shows what the server now
   * holds, images with their fresh links, and keeps the subtasks the list already has.
   */
  const taskSaved = useCallback((data: DailyTask) => {
    setPage((current) => (current ? { ...current, days: changeTask(current.days, data.id, (entry) => ({ ...data, subtasks: entry.subtasks })) } : current))
  }, [])

  /** A subtask added under a task, from its editor: it appears under that task at once. */
  const addSubtask = async (parent: DailyTask, content: string): Promise<boolean> => {
    setTaskError(null)
    try {
      const { data } = await requestApi<{ tasks: DailyTask[] }>(DAILY_TASKS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ today, taskDate: parent.taskDate, contents: [content], parentTaskId: parent.id }),
      }, { idempotent: true })
      const added = data.tasks[0]
      if (!added) return false
      setPage((current) =>
        current
          ? {
              ...current,
              days: changeTask(current.days, parent.id, (entry) => ({ ...entry, subtasks: [...entry.subtasks, added] })),
              overdueCount: added.taskDate < today ? current.overdueCount + 1 : current.overdueCount,
            }
          : current
      )
      return true
    } catch (error: unknown) {
      setTaskError(error instanceof Error ? error.message : DAILY_TASKS_MESSAGES.addToDayFailed)
      return false
    }
  }

  /** A copy of a task with everything under it, straight after it: the list is read again to show it in place. */
  const copyTask = async (task: DailyTask) => {
    setTaskError(null)
    try {
      await requestApi<DailyTask>(`${DAILY_TASKS_ENDPOINT}/${task.id}/copy`, { method: "POST" }, { idempotent: true })
      reload()
    } catch (error: unknown) {
      setTaskError(error instanceof Error ? error.message : TASK_ATTACHMENT_MESSAGES.copyFailed)
    }
  }

  /**
   * Brings what was left open on earlier days onto today, at the end of the list, each task with its
   * subtasks: the same move a drag across days makes, without the drag. With a task named it is that
   * one, from the button on its row; without one it is every overdue task, from the header.
   */
  const moveOverdue = async (task?: DailyTask) => {
    if (isMovingOverdue) return
    setIsMovingOverdue(true)
    setTaskError(null)
    try {
      const { message } = await requestApi<{ moved: number }>(
        `${DAILY_TASKS_ENDPOINT}/move-overdue`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ today, ...(task ? { ids: [task.id] } : {}) }) },
        { retry: true }
      )
      setNotice(message || null)
      reload()
    } catch (error: unknown) {
      setTaskError(error instanceof Error ? error.message : DAILY_TASKS_MESSAGES.moveOverdueFailed)
    } finally {
      setIsMovingOverdue(false)
    }
  }

  const removeTask = async (task: DailyTask) => {
    if (pendingIds.has(task.id)) return
    setTaskError(null)
    setPendingIds((current) => new Set(current).add(task.id))
    const snapshot = page
    setPage((current) =>
      current
        ? {
            ...current,
            // A subtask leaves its task; a day's own task leaves the day, taking its subtasks with it
            days: current.days
              .map((day) => ({ ...day, tasks: removeNested(day.tasks, task.id) }))
              .filter((day) => day.tasks.length > 0),
            overdueCount:
              !task.isCompleted && task.taskDate < today ? Math.max(0, current.overdueCount - 1) : current.overdueCount,
            olderTaskCount:
              task.taskDate < current.windowStart ? Math.max(0, current.olderTaskCount - 1) : current.olderTaskCount,
          }
        : current
    )
    try {
      await requestApi<{ deleted: boolean }>(`${DAILY_TASKS_ENDPOINT}/${task.id}`, { method: "DELETE" })
      // An emptied page may no longer exist, and the counts only knew about this one task, not the
      // subtasks that went with it, so the list asks the server what is left
      if (task.subtasks.length > 0) reload()
      setPage((current) => {
        if (current && current.days.length === 0) reload()
        return current
      })
    } catch (error: unknown) {
      setPage(snapshot)
      setTaskError(error instanceof Error ? error.message : DAILY_TASKS_MESSAGES.deleteFailed)
    } finally {
      setPendingIds((current) => {
        const next = new Set(current)
        next.delete(task.id)
        return next
      })
    }
  }

  const deleteOlderTasks = async () => {
    if (isDeleting || !today) return
    setIsDeleting(true)
    setCleanupError(null)
    try {
      const { message } = await requestApi<{ deleted: number }>(`${DAILY_TASKS_ENDPOINT}?today=${today}`, {
        method: "DELETE",
      })
      setIsConfirmingCleanup(false)
      setNotice(message || DAILY_TASKS_MESSAGES.cleaned)
      showNewest()
    } catch (error: unknown) {
      setCleanupError(error instanceof Error ? error.message : DAILY_TASKS_MESSAGES.cleanupFailed)
    } finally {
      setIsDeleting(false)
    }
  }

  // The task open in the editor and the tasks above it, read from the list so it always shows what the list does
  const editingPath = editing && page ? page.days.map((day) => pathTo(day.tasks, editing.id)).find((path) => path !== null) ?? null : null
  const olderTaskCount = page?.olderTaskCount ?? 0
  const overdueCount = page?.overdueCount ?? 0

  return (
    <div className="font-body-md text-body-md min-h-screen bg-background text-on-surface flex overflow-hidden h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        <Header
          onOpenSidebar={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapsed}
        />

        <main className="flex-1 overflow-y-auto bg-background overflow-x-hidden">
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-5 lg:h-full">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                  <ListTodo size={24} className="text-primary shrink-0" aria-hidden="true" />
                  Daily Tasks
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Write the day&apos;s tasks in one go, tick them off, and see what is still open.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                {overdueCount > 0 && (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-error-container px-3 py-1.5 text-xs font-bold text-on-error-container">
                      <AlertTriangle size={14} aria-hidden="true" />
                      {overdueCount} overdue
                    </span>
                    <button
                      type="button"
                      onClick={() => void moveOverdue()}
                      disabled={isMovingOverdue}
                      title="Every task still open on an earlier day moves to the end of today, with its subtasks"
                      className="inline-flex items-center justify-center whitespace-nowrap gap-2 rounded-xl border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isMovingOverdue ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CalendarArrowUp size={16} aria-hidden="true" />}
                      {DAILY_TASKS_MESSAGES.moveOverdue(overdueCount)}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setCleanupError(null)
                    setIsConfirmingCleanup(true)
                  }}
                  disabled={olderTaskCount === 0 || isDeleting}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap gap-2 px-4 py-2.5 border border-error/40 text-error rounded-xl text-sm font-semibold transition-colors hover:bg-error/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Delete data older than one week
                </button>
              </div>
            </div>

            <div className="min-h-[20px] shrink-0 text-[12px]" aria-live="polite">
              {taskError && (
                <p role="alert" className="flex flex-wrap items-center gap-2 text-error">
                  {taskError}
                  <button type="button" onClick={reload} className="font-semibold underline hover:no-underline">
                    Reload tasks
                  </button>
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-5 lg:flex-1 lg:min-h-0">
              <TaskComposer
                today={today}
                taskDate={taskDate || today}
                rows={rows}
                isSaving={isSaving}
                error={saveError}
                notice={notice}
                onDateChange={(date) => {
                  draftStore.update({ taskDate: date })
                  setSaveError(null)
                }}
                onRowsChange={(next) => {
                  draftStore.update({ rows: next })
                  if (saveError) setSaveError(null)
                }}
                onSubmit={addTasks}
              />

              <TaskDayList
                page={page}
                today={today}
                isLoading={isLoading}
                error={loadError}
                pendingIds={pendingIds}
                onRetry={reload}
                onPageChange={goToPage}
                onToggle={toggleTask}
                onDelete={removeTask}
                onDeletePicked={(ids) => setConfirmingPicked(ids)}
                onMove={moveTask}
                onAddTask={addTaskToDay}
                onOpenTask={(task, focusSubtask = false) => setEditing({ id: task.id, focusSubtask })}
                onCopy={(task) => void copyTask(task)}
                onMoveToToday={(task) => void moveOverdue(task)}
              />
            </div>
          </div>
        </main>
      </div>

      {confirmingPicked && (
        <ConfirmBulkDelete
          count={confirmingPicked.length}
          noun={{ one: "task", many: "tasks" }}
          isDeleting={isDeletingPicked}
          onConfirm={() => void removePicked(confirmingPicked)}
          onClose={() => setConfirmingPicked(null)}
        />
      )}
      {editingPath && (
        <TaskEditorDialog
          // A different task is a fresh editor, starting from what that task holds
          key={editingPath[editingPath.length - 1].id}
          task={editingPath[editingPath.length - 1]}
          ancestors={editingPath.slice(0, -1)}
          focusSubtask={editing?.focusSubtask ?? false}
          pendingIds={pendingIds}
          onSaved={taskSaved}
          onToggle={toggleTask}
          onCopy={(task) => void copyTask(task)}
          onDelete={removeTask}
          onAddSubtask={addSubtask}
          onOpenTask={(id, focusSubtask = false) => setEditing({ id, focusSubtask })}
          onClose={() => setEditing(null)}
        />
      )}
      {isConfirmingCleanup && (
        <CleanupOldTasksDialog
          total={olderTaskCount}
          windowStart={page?.windowStart ?? today}
          isDeleting={isDeleting}
          error={cleanupError}
          onConfirm={deleteOlderTasks}
          onClose={() => {
            if (isDeleting) return
            setIsConfirmingCleanup(false)
            setCleanupError(null)
          }}
        />
      )}
    </div>
  )
}
