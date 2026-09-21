"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, Check, CheckCircle2, ChevronRight, Copy, CornerDownRight, Loader2, Plus, Trash2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { AiSourceLabel } from "@/components/ui/AiSourceLabel"
import { TaskDetailsFields } from "@/components/tasks/TaskDetailsFields"
import { requestApi } from "@/lib/apiClient"
import { writeTaskDetails } from "@/lib/taskDetailsAi"
import { DAILY_TASKS_ENDPOINT, DAILY_TASKS_MESSAGES, TASK_MAX_LENGTH } from "@/constants/dailyTasks"
import { TASK_ATTACHMENT_MESSAGES, TASK_DESCRIPTION_MAX_LENGTH, TASK_MAX_DEPTH } from "@/constants/taskAttachments"
import type { DailyTask } from "@/types/dailyTasks"
import { toStoredImages, type TaskDetailsDraft } from "@/types/taskAttachment"
import type { AiSource } from "@/types/ai"

// How long after the last change the task saves itself
const AUTOSAVE_DELAY_MS = 1000

interface TaskEditorDialogProps {
  task: DailyTask
  // The tasks above it, the top one first; empty for a day's own task
  ancestors: DailyTask[]
  // Opened from "Add subtask": the new-subtask field takes the focus
  focusSubtask: boolean
  pendingIds: ReadonlySet<string>
  // The saved task, answered by the server; the page keeps its subtasks as they are
  onSaved: (task: DailyTask) => void
  onToggle: (task: DailyTask, isCompleted: boolean) => void
  onCopy: (task: DailyTask) => void
  onDelete: (task: DailyTask) => void
  // Adds one subtask under a task; resolves true when it was added
  onAddSubtask: (parent: DailyTask, content: string) => Promise<boolean>
  // Opens another task in this editor (a subtask, or a task above)
  onOpenTask: (id: string, focusSubtask?: boolean) => void
  onClose: () => void
}

interface Draft {
  content: string
  details: TaskDetailsDraft
}

type AutoSave = { state: "idle" } | { state: "saving" } | { state: "saved"; at: string } | { state: "failed"; message: string }

const draftOf = (task: DailyTask): Draft => ({ content: task.content, details: { description: task.description, images: task.images, uploading: 0 } })

// What the server is sent, and what decides whether anything is left to save
const bodyOf = (draft: Draft) =>
  JSON.stringify({ content: draft.content.trim(), description: draft.details.description.trim(), images: toStoredImages(draft.details.images) })

const isSaveable = (draft: Draft) =>
  Boolean(draft.content.trim()) && draft.details.uploading === 0 && draft.details.description.length <= TASK_DESCRIPTION_MAX_LENGTH

const clock = () => new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })

const levelName = (depth: number) => (depth === 1 ? "Task" : depth === 2 ? "Subtask" : "Sub-subtask")

/**
 * Everything about one task in one place: its line, its details (formatted text, images, written by
 * hand or with AI) and its subtasks. It is a popup rather than something opened inside the row,
 * because the whole row of a daily task is what drags it: a text box in there would start a drag at
 * the first press.
 *
 * **It saves itself.** A moment after each change (AUTOSAVE_DELAY_MS) the task is saved, and the
 * footer says when; saves never overlap, and one waits for an image still uploading. Save saves at
 * once and closes, and closing or opening another task saves anything still waiting first.
 *
 * **Subtasks go three levels deep** (TASK_MAX_DEPTH): a task, its subtasks and theirs. Each is opened
 * here in turn, ticked, copied or deleted from the list below the details; on a sub-subtask the field
 * that would add a fourth level is replaced by a line saying so.
 */
export const TaskEditorDialog: React.FC<TaskEditorDialogProps> = ({
  task,
  ancestors,
  focusSubtask,
  pendingIds,
  onSaved,
  onToggle,
  onCopy,
  onDelete,
  onAddSubtask,
  onOpenTask,
  onClose,
}) => {
  const [draft, setDraft] = useState<Draft>(() => draftOf(task))
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [autoSave, setAutoSave] = useState<AutoSave>({ state: "idle" })
  const [isClosing, setIsClosing] = useState(false)
  const [source, setSource] = useState<AiSource | null>(null)
  const [subtask, setSubtask] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const subtaskRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const depth = ancestors.length + 1
  const canNest = depth < TASK_MAX_DEPTH

  // What the server holds, and the draft as the timer sees it
  const saved = useRef(bodyOf(draftOf(task)))
  const latest = useRef(draft)
  const running = useRef<Promise<boolean> | null>(null)
  useEffect(() => {
    latest.current = draft
  }, [draft])

  /** Sends the task as it stands; a change made meanwhile goes after this one, never alongside. */
  const save = useCallback(async (): Promise<boolean> => {
    if (running.current) await running.current
    const current = latest.current
    const body = bodyOf(current)
    if (body === saved.current) return true
    if (!isSaveable(current)) return false
    const attempt = (async () => {
      setAutoSave({ state: "saving" })
      try {
        const { data } = await requestApi<DailyTask>(`${DAILY_TASKS_ENDPOINT}/${task.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body,
        })
        saved.current = body
        onSaved(data)
        setAutoSave({ state: "saved", at: clock() })
        return true
      } catch (error: unknown) {
        setAutoSave({ state: "failed", message: error instanceof Error ? error.message : TASK_ATTACHMENT_MESSAGES.autosaveFailed })
        return false
      }
    })()
    running.current = attempt
    const ok = await attempt
    running.current = null
    return ok
  }, [task.id, onSaved])

  // Typing settles, then the task saves itself
  useEffect(() => {
    if (!isSaveable(draft) || bodyOf(draft) === saved.current) return
    const timer = window.setTimeout(() => void save(), AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [draft, save])

  useEffect(() => {
    if (focusSubtask && canNest) subtaskRef.current?.focus()
  }, [focusSubtask, canNest])

  /** Saves what is still waiting, then leaves; a save that fails keeps the editor open, saying why. */
  const leave = async (then: () => void) => {
    if (isClosing) return
    if (latest.current.details.uploading > 0) {
      setFieldError("Wait for the images to finish uploading.")
      return
    }
    if (!latest.current.content.trim()) {
      setFieldError(DAILY_TASKS_MESSAGES.missingContent)
      titleRef.current?.focus()
      return
    }
    setIsClosing(true)
    const ok = await save()
    setIsClosing(false)
    if (ok) then()
  }

  const generate = async (): Promise<string> => {
    const written = await writeTaskDetails("daily-tasks", {
      title: latest.current.content,
      parents: ancestors.map((entry) => entry.content),
      description: latest.current.details.description,
    })
    setSource(written)
    return written.details
  }

  const addSubtask = async () => {
    const content = subtask.trim()
    if (!content || isAdding || !canNest) return
    setIsAdding(true)
    const added = await onAddSubtask(task, content)
    setIsAdding(false)
    if (added) {
      setSubtask("")
      subtaskRef.current?.focus()
    }
  }

  const status = (() => {
    if (!draft.content.trim()) {
      return (
        <span className="inline-flex items-center gap-1.5 text-on-secondary-fixed-variant">
          <AlertCircle size={14} aria-hidden="true" />
          {DAILY_TASKS_MESSAGES.missingContent}
        </span>
      )
    }
    switch (autoSave.state) {
      case "saving":
        return (
          <span className="inline-flex items-center gap-1.5 text-on-surface-variant">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            {TASK_ATTACHMENT_MESSAGES.autosaving}
          </span>
        )
      case "saved":
        return (
          <span className="inline-flex items-center gap-1.5 font-semibold text-success">
            <CheckCircle2 size={14} aria-hidden="true" />
            {TASK_ATTACHMENT_MESSAGES.autosaved(autoSave.at)}
          </span>
        )
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 text-error">
            <AlertCircle size={14} aria-hidden="true" />
            {autoSave.message}
          </span>
        )
      default:
        return <span className="text-outline">Changes save themselves as you type.</span>
    }
  })()

  return (
    <Modal
      title={`${levelName(depth)} details`}
      description={ancestors.length > 0 ? undefined : "Its line, its details and its subtasks, saved as you type."}
      onClose={() => void leave(onClose)}
      isCloseDisabled={isClosing}
      initialFocusRef={focusSubtask && canNest ? subtaskRef : titleRef}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p role="status" aria-live="polite" className="min-h-[20px] text-[12px]">
            {fieldError ? (
              <span role="alert" className="text-error">
                {fieldError}
              </span>
            ) : (
              status
            )}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => void leave(onClose)}
              disabled={isClosing}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => void leave(onClose)}
              disabled={isClosing || draft.details.uploading > 0}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-50"
            >
              {isClosing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
              Save
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {ancestors.length > 0 && (
          <nav aria-label="Where this task sits" className="flex flex-wrap items-center gap-1 text-[12px] text-on-surface-variant">
            {ancestors.map((entry) => (
              <React.Fragment key={entry.id}>
                <button
                  type="button"
                  onClick={() => void leave(() => onOpenTask(entry.id))}
                  className="max-w-[220px] truncate rounded-md px-1.5 py-0.5 font-semibold text-primary hover:bg-primary/5"
                >
                  {entry.content}
                </button>
                <ChevronRight size={13} className="text-outline" aria-hidden="true" />
              </React.Fragment>
            ))}
            <span className="max-w-[220px] truncate font-semibold text-on-surface">{draft.content || "This task"}</span>
          </nav>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-outline">{levelName(depth)}</span>
          <input
            ref={titleRef}
            value={draft.content}
            maxLength={TASK_MAX_LENGTH}
            onChange={(event) => {
              const content = event.target.value
              setDraft((current) => ({ ...current, content }))
              setFieldError(null)
            }}
            className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[14px] font-semibold text-on-surface focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </label>

        <div>
          <TaskDetailsFields
            idPrefix={`task-${task.id}`}
            details={draft.details}
            onChange={(details) => setDraft((current) => ({ ...current, details }))}
            onError={setFieldError}
            disabled={isClosing}
            onGenerate={generate}
            alwaysOpen
          />
          {source && (
            <p className="mt-1 text-[11px] text-outline">
              <AiSourceLabel source={source} prefix="" />
            </p>
          )}
        </div>

        <section aria-labelledby={`subtasks-${task.id}`} className="flex flex-col gap-2">
          <h3 id={`subtasks-${task.id}`} className="text-[10px] font-bold uppercase tracking-wider text-outline">
            {depth === 1 ? "Subtasks" : "Sub-subtasks"}{" "}
            {task.subtasks.length > 0 && (
              <span className="normal-case tracking-normal">
                ({task.subtasks.filter((entry) => entry.isCompleted).length} of {task.subtasks.length} done)
              </span>
            )}
          </h3>
          {task.subtasks.length > 0 && (
            <ul className="flex flex-col gap-1">
              {task.subtasks.map((entry) => {
                const isPending = pendingIds.has(entry.id)
                return (
                  <li key={entry.id} className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={entry.isCompleted}
                      disabled={isPending}
                      onChange={(event) => onToggle(entry, event.target.checked)}
                      aria-label={`Done: ${entry.content}`}
                      className="h-4 w-4 shrink-0 accent-primary"
                    />
                    <button
                      type="button"
                      onClick={() => void leave(() => onOpenTask(entry.id))}
                      title="Open it here"
                      className={`min-w-0 flex-1 truncate rounded-md px-1 py-1 text-left text-[13px] hover:bg-primary/5 hover:text-primary ${
                        entry.isCompleted ? "text-outline line-through" : "text-on-surface"
                      }`}
                    >
                      {entry.content}
                      {entry.subtasks.length > 0 && (
                        <span className="ml-2 text-[11px] font-semibold text-outline no-underline">
                          {entry.subtasks.length} {entry.subtasks.length === 1 ? "subtask" : "subtasks"}
                        </span>
                      )}
                    </button>
                    {depth + 1 < TASK_MAX_DEPTH && (
                      <button
                        type="button"
                        onClick={() => void leave(() => onOpenTask(entry.id, true))}
                        aria-label={`${TASK_ATTACHMENT_MESSAGES.addSubSubtask} under ${entry.content}`}
                        title={TASK_ATTACHMENT_MESSAGES.addSubSubtask}
                        className="shrink-0 rounded-lg p-1.5 text-outline hover:bg-primary/10 hover:text-primary"
                      >
                        <CornerDownRight size={14} aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onCopy(entry)}
                      disabled={isPending}
                      aria-label={`${TASK_ATTACHMENT_MESSAGES.copyTask}: ${entry.content}`}
                      title={TASK_ATTACHMENT_MESSAGES.copyTask}
                      className="shrink-0 rounded-lg p-1.5 text-outline hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                    >
                      <Copy size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(entry)}
                      disabled={isPending}
                      aria-label={`Delete: ${entry.content}`}
                      className="shrink-0 rounded-lg p-1.5 text-outline hover:bg-error/10 hover:text-error disabled:opacity-40"
                    >
                      {isPending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {canNest ? (
            <div className="flex items-center gap-2">
              <input
                ref={subtaskRef}
                value={subtask}
                maxLength={TASK_MAX_LENGTH}
                onChange={(event) => setSubtask(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void addSubtask()
                  }
                }}
                disabled={isAdding}
                aria-label={depth === 1 ? TASK_ATTACHMENT_MESSAGES.addSubtask : TASK_ATTACHMENT_MESSAGES.addSubSubtask}
                placeholder={`${TASK_ATTACHMENT_MESSAGES.subtaskPlaceholder} (Enter to add)`}
                className="h-9 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[13px] text-on-surface placeholder:text-outline focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => void addSubtask()}
                disabled={isAdding || !subtask.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-50"
              >
                {isAdding ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                {depth === 1 ? TASK_ATTACHMENT_MESSAGES.addSubtask : TASK_ATTACHMENT_MESSAGES.addSubSubtask}
              </button>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-outline-variant px-3 py-2 text-[12px] text-on-surface-variant">{TASK_ATTACHMENT_MESSAGES.depthReached}</p>
          )}
        </section>
      </div>
    </Modal>
  )
}
