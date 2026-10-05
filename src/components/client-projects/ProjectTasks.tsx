"use client"

import React from "react"
import { Loader2, Pencil, Trash2 } from "lucide-react"
import { TaskDetailsView } from "@/components/tasks/TaskDetailsView"
import { PROJECT_DETAILS_OPEN_MAX_CHARS, PROJECT_TASK_MESSAGES, projectItemKind, type ProjectItemKind } from "@/constants/clientProjectTasks"
import { clock } from "./VoiceNoteField"
import { FileKindIcon, fileSize } from "./ProjectFilesField"
import type { ProjectFileView, ProjectTask } from "@/types/clientProjectTasks"

interface ProjectTasksProps {
  tasks: ProjectTask[]
  // Which tab these are, so the empty line and the tick's label read as that tab's own words
  kind: ProjectItemKind
  busyId?: string | null
  onTick: (task: ProjectTask, done: boolean) => void
  onEdit: (task: ProjectTask) => void
  onDelete: (task: ProjectTask) => void
  /**
   * How an item added from the shared link is tagged. The two surfaces word it differently (the
   * owner reads "From the client"; the client reads nothing about themselves), so each passes its
   * own and a surface that wants no tag at all passes none.
   */
  clientTag?: string
  /**
   * Open each item's description and images from the start, which is what a shared link does. A
   * description too long to sit in a list (`PROJECT_DETAILS_OPEN_MAX_CHARS`) still starts folded,
   * so one specification cannot bury every item under it.
   */
  detailsOpen?: boolean
}

const actionButton =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold text-outline transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"

/** One item's voice note, as a player. The same markup on the page and behind a shared link. */
const VoiceNotePlayer: React.FC<{ task: ProjectTask }> = ({ task }) =>
  task.voiceNote ? (
    <div className="flex flex-wrap items-center gap-2">
      <audio src={task.voiceNote.url} controls preload="none" className="h-9 min-w-0 max-w-full flex-1" aria-label={`Voice note on ${task.content}`} />
      <span className="text-[11px] text-outline">{clock(task.voiceNote.seconds)}</span>
    </div>
  ) : null

/**
 * The files on one item: a video and an audio file play where they are, and everything else is a
 * row that opens or downloads by its own name. The same markup on the page and behind a shared
 * link, since both may have put them there.
 */
const ItemFiles: React.FC<{ files: ProjectFileView[] }> = ({ files }) =>
  files.length === 0 ? null : (
    <ul className="flex flex-col gap-1.5">
      {files.map((file) =>
        file.category === "video" ? (
          <li key={file.assetId} className="flex flex-col gap-1">
            <video src={file.url} controls preload="none" className="max-h-[320px] w-full rounded-xl bg-black" aria-label={file.name} />
            <span className="text-[11px] text-outline">
              {file.name} · {fileSize(file.size)}
            </span>
          </li>
        ) : file.category === "audio" ? (
          <li key={file.assetId} className="flex flex-wrap items-center gap-2">
            <audio src={file.url} controls preload="none" className="h-9 min-w-0 max-w-full flex-1" aria-label={file.name} />
            <span className="text-[11px] text-outline">{file.name}</span>
          </li>
        ) : (
          <li key={file.assetId}>
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-2.5 py-1.5 transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <FileKindIcon category={file.category} className="shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-on-surface" title={file.name}>
                {file.name}
              </span>
              <span className="shrink-0 text-[11px] text-outline">{fileSize(file.size)}</span>
            </a>
          </li>
        )
      )}
    </ul>
  )

/**
 * One tab of a client project: each item's line, whether it is ticked off, its description, its
 * images and its voice note.
 *
 * The owner's page and the shared link render **the same list with the same controls**, because the
 * client may change what they are looking at: that is the whole point of the link. What differs is
 * only how an item added from the link is tagged, and whether the details start open.
 */
export const ProjectTasks: React.FC<ProjectTasksProps> = ({ tasks, kind, busyId, onTick, onEdit, onDelete, clientTag, detailsOpen }) => {
  const words = projectItemKind(kind)

  if (tasks.length === 0) {
    return <p className="rounded-xl border border-dashed border-outline-variant px-3 py-6 text-center text-[13px] text-outline">{words.empty}</p>
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
              <input
                type="checkbox"
                checked={isDone}
                disabled={busyId === task.id}
                onChange={(event) => onTick(task, event.target.checked)}
                aria-label={`${task.content} is ${words.doneLabel}`}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <div className="min-w-0 flex-1">
                <p className={`break-words text-[13px] ${isDone ? "text-on-surface-variant line-through" : "text-on-surface"}`}>{task.content}</p>
                {clientTag && task.addedBy === "client" && (
                  <span className="mt-1 inline-block rounded-full bg-primary-fixed px-2 py-0.5 text-[10px] font-semibold text-on-primary-fixed-variant">
                    {clientTag}
                  </span>
                )}
              </div>
              {busyId === task.id && <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin text-primary" aria-hidden="true" />}
              <div className="flex shrink-0 items-center gap-0.5">
                <button type="button" onClick={() => onEdit(task)} aria-label={`Edit ${task.content}`} className={`${actionButton} hover:text-primary`}>
                  <Pencil size={13} aria-hidden="true" />
                  Edit
                </button>
                <button type="button" onClick={() => onDelete(task)} aria-label={`Delete ${task.content}`} className={`${actionButton} hover:text-error`}>
                  <Trash2 size={13} aria-hidden="true" />
                  Delete
                </button>
              </div>
            </div>

            {(task.description || task.images.length > 0) && (
              <div className="pl-6">
                <TaskDetailsView
                  description={task.description}
                  images={task.images}
                  label={task.content}
                  defaultOpen={detailsOpen && task.description.length <= PROJECT_DETAILS_OPEN_MAX_CHARS}
                />
              </div>
            )}
            {task.files.length > 0 && (
              <div className="pl-6">
                <ItemFiles files={task.files} />
              </div>
            )}
            {task.voiceNote && <div className="pl-6">{<VoiceNotePlayer task={task} />}</div>}
          </li>
        )
      })}
    </ul>
  )
}

/** What a delete asks before it happens, named by the tab the item is on. */
export const deleteItemTitle = (kind: ProjectItemKind) => `Delete this ${projectItemKind(kind).one}?`
export const deleteItemExplains = PROJECT_TASK_MESSAGES.deleteExplains
