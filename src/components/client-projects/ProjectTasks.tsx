"use client"

import React from "react"
import { Loader2, Pencil, Trash2 } from "lucide-react"
import { TaskDetailsView } from "@/components/tasks/TaskDetailsView"
import { PROJECT_TASK_MESSAGES } from "@/constants/clientProjectTasks"
import { clock } from "./VoiceNoteField"
import type { ProjectTask } from "@/types/clientProjectTasks"

interface ProjectTasksProps {
  tasks: ProjectTask[]
  /**
   * The read-only view a public link opens: the tasks, their details, their images and their voice
   * notes, with no checkbox and no actions. Everything that changes a task is left out here rather
   * than disabled, so the link cannot even ask.
   */
  readOnly?: boolean
  busyId?: string | null
  onTick?: (task: ProjectTask, done: boolean) => void
  onEdit?: (task: ProjectTask) => void
  onDelete?: (task: ProjectTask) => void
}

const actionButton =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold text-outline transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"

/** One task's voice note, as a player. The same markup on the page and behind a public link. */
const VoiceNotePlayer: React.FC<{ task: ProjectTask }> = ({ task }) =>
  task.voiceNote ? (
    <div className="flex flex-wrap items-center gap-2">
      <audio src={task.voiceNote.url} controls preload="none" className="h-9 min-w-0 max-w-full flex-1" aria-label={`Voice note on ${task.content}`} />
      <span className="text-[11px] text-outline">{clock(task.voiceNote.seconds)}</span>
    </div>
  ) : null

/**
 * The tasks of one client project: the line, whether it is done, its description, its images and
 * its voice note. The page passes what changes a task; a public link passes nothing, so the same
 * list reads the same for a client who was sent it and cannot be used to change anything.
 */
export const ProjectTasks: React.FC<ProjectTasksProps> = ({ tasks, readOnly, busyId, onTick, onEdit, onDelete }) => {
  if (tasks.length === 0) {
    return <p className="rounded-xl border border-dashed border-outline-variant px-3 py-6 text-center text-[13px] text-outline">{PROJECT_TASK_MESSAGES.empty}</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => {
        const isDone = task.status === "done"
        return (
          <li
            key={task.id}
            className={`flex flex-col gap-2 rounded-2xl border p-3 transition-colors ${
              isDone ? "border-success/40 bg-success-container/40" : "border-outline-variant bg-white"
            }`}
          >
            <div className="flex items-start gap-2">
              {readOnly ? (
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                    isDone ? "border-success bg-success text-white" : "border-outline-variant"
                  }`}
                >
                  {isDone ? "✓" : ""}
                </span>
              ) : (
                <input
                  type="checkbox"
                  checked={isDone}
                  disabled={busyId === task.id}
                  onChange={(event) => onTick?.(task, event.target.checked)}
                  aria-label={`${task.content} is done`}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
              )}
              <p className={`min-w-0 flex-1 break-words text-[13px] ${isDone ? "text-on-surface-variant line-through" : "text-on-surface"}`}>{task.content}</p>
              {busyId === task.id && <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin text-primary" aria-hidden="true" />}
              {!readOnly && (
                <div className="flex shrink-0 items-center gap-0.5">
                  <button type="button" onClick={() => onEdit?.(task)} aria-label={`Edit ${task.content}`} className={`${actionButton} hover:text-primary`}>
                    <Pencil size={13} aria-hidden="true" />
                    Edit
                  </button>
                  <button type="button" onClick={() => onDelete?.(task)} aria-label={`Delete ${task.content}`} className={`${actionButton} hover:text-error`}>
                    <Trash2 size={13} aria-hidden="true" />
                    Delete
                  </button>
                </div>
              )}
            </div>

            {(task.description || task.images.length > 0) && (
              <div className="pl-6">
                <TaskDetailsView description={task.description} images={task.images} label={task.content} defaultOpen={readOnly} />
              </div>
            )}
            {task.voiceNote && <div className="pl-6">{<VoiceNotePlayer task={task} />}</div>}
          </li>
        )
      })}
    </ul>
  )
}
