"use client"

import React, { useState } from "react"
import { Download, Eye, Link2, Loader2, Pencil, Trash2 } from "lucide-react"
import { TaskDetailsView } from "@/components/tasks/TaskDetailsView"
import {
  PROJECT_DETAILS_OPEN_MAX_CHARS,
  PROJECT_FILE_MESSAGES,
  PROJECT_TASK_MESSAGES,
  projectItemKind,
  type ProjectItemKind,
} from "@/constants/clientProjectTasks"
import { shownItems } from "@/lib/projectItems"
import { clock } from "./VoiceNoteField"
import { FileKindIcon, fileSize } from "./ProjectFilesField"
import { FilePreviewDialog } from "./FilePreviewDialog"
import type { ProjectFileView, ProjectTask } from "@/types/clientProjectTasks"

interface ProjectTasksProps {
  tasks: ProjectTask[]
  // Which tab these are, so the empty line, the tick's label and the shape of a row are that tab's
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

/** The day an item was saved, which is what a backup is read by. */
const savedOn = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })

/** One item's voice note, as a player. The same markup on the page and behind a shared link. */
const VoiceNotePlayer: React.FC<{ task: ProjectTask }> = ({ task }) =>
  task.voiceNote ? (
    <div className="flex flex-wrap items-center gap-2">
      <audio src={task.voiceNote.url} controls preload="none" className="h-9 min-w-0 max-w-full flex-1" aria-label={`Voice note on ${task.content}`} />
      <span className="text-[11px] text-outline">{clock(task.voiceNote.seconds)}</span>
    </div>
  ) : null

/**
 * The files on one item, and the two things anyone wants to do with one: **see it** and **keep it**.
 *
 * A video and a sound play where they are, and an image shows as a picture, because that is faster
 * than a dialog for the one glance most files get. Every file, whatever it is, also has Preview
 * (the whole popup, `FilePreviewDialog`) and Download, which saves it under its own name; Preview
 * is left out only for a type no browser can show, which today is a Word document.
 */
const ItemFiles: React.FC<{ files: ProjectFileView[]; onPreview: (file: ProjectFileView) => void }> = ({ files, onPreview }) => {
  if (files.length === 0) return null
  return (
    <ul className="flex flex-col gap-2">
      {files.map((file) => {
        const actions = (
          <span className="flex shrink-0 items-center gap-0.5">
            {/* Every file has it, including the one no browser can show: the viewer then says so
                and offers the download, rather than the row quietly having one button fewer */}
            <button type="button" onClick={() => onPreview(file)} className={`${actionButton} hover:text-primary`} aria-label={`Preview ${file.name}`}>
              <Eye size={13} aria-hidden="true" />
              {PROJECT_FILE_MESSAGES.preview}
            </button>
            <a href={file.url} download={file.name} className={`${actionButton} hover:text-primary`} aria-label={`Download ${file.name}`}>
              <Download size={13} aria-hidden="true" />
              {PROJECT_FILE_MESSAGES.download}
            </a>
          </span>
        )
        const caption = (
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-[11px] text-outline">
            <span className="min-w-0 truncate font-semibold text-on-surface" title={file.name}>
              {file.name}
            </span>
            <span className="shrink-0">{fileSize(file.size)}</span>
          </span>
        )

        if (file.category === "video" && file.previewUrl) {
          return (
            <li key={file.assetId} className="flex flex-col gap-1">
              <video src={file.previewUrl} controls preload="metadata" className="max-h-[320px] w-full rounded-xl bg-black" aria-label={file.name} />
              <span className="flex flex-wrap items-center gap-2">
                {caption}
                {actions}
              </span>
            </li>
          )
        }
        if (file.category === "audio" && file.previewUrl) {
          return (
            <li key={file.assetId} className="flex flex-wrap items-center gap-2">
              <audio src={file.previewUrl} controls preload="none" className="h-9 min-w-0 flex-1" aria-label={file.name} />
              {caption}
              {actions}
            </li>
          )
        }
        if (file.category === "image" && file.previewUrl) {
          return (
            <li key={file.assetId} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => onPreview(file)}
                className="overflow-hidden rounded-xl border border-outline-variant bg-white p-1 transition-colors hover:border-primary/50"
                aria-label={`Preview ${file.name}`}
              >
                {/* A short-lived signed link on the storage host, like every other stored image here, so a plain img */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={file.previewUrl} alt={file.name} className="max-h-48 w-auto max-w-full rounded-lg object-contain" />
              </button>
              <span className="flex flex-wrap items-center gap-2">
                {caption}
                {actions}
              </span>
            </li>
          )
        }
        return (
          <li key={file.assetId} className="flex flex-wrap items-center gap-2 rounded-xl border border-outline-variant bg-white px-2.5 py-1.5">
            <FileKindIcon category={file.category} className="shrink-0 text-primary" />
            {caption}
            {actions}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * One tab of a client project: its items, each one laid out as that tab's own kind asks. A change,
 * an idea and a message have a tick and carry anything; a credential is a name and what is written
 * under it; a link is a name and an address; a document and a backup are their files, and a backup
 * is numbered and dated, newest first.
 *
 * The owner's page and the shared link render **the same list with the same controls**, because the
 * client may change what they are looking at: that is the whole point of the link. What differs is
 * only how an item added from the link is tagged, whether the details start open, and which tabs
 * the link is given at all (never Credentials or Backups).
 */
export const ProjectTasks: React.FC<ProjectTasksProps> = ({ tasks, kind, busyId, onTick, onEdit, onDelete, clientTag, detailsOpen }) => {
  const words = projectItemKind(kind)
  const shape = words.shape
  // The file being looked at, over the whole popup. One at a time, for the whole list
  const [preview, setPreview] = useState<ProjectFileView | null>(null)

  if (tasks.length === 0) {
    return <p className="rounded-xl border border-dashed border-outline-variant px-3 py-6 text-center text-[13px] text-outline">{words.empty}</p>
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {shownItems(kind, tasks).map(({ item: task, number }) => {
          const isDone = task.status === "done"
          return (
            <li
              key={task.id}
              className={`flex flex-col gap-2 rounded-2xl border p-3 transition-colors ${
                isDone && shape.tick ? "border-success/40 bg-success-container/40" : "border-outline-variant bg-white"
              }`}
            >
              <div className="flex items-start gap-2">
                {shape.tick ? (
                  <input
                    type="checkbox"
                    checked={isDone}
                    disabled={busyId === task.id}
                    onChange={(event) => onTick(task, event.target.checked)}
                    aria-label={`${task.content} is ${words.doneLabel}`}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  />
                ) : (
                  shape.numbered && <span className="mt-0.5 shrink-0 rounded-md bg-primary-fixed px-1.5 py-0.5 text-[11px] font-bold text-on-primary-fixed-variant">#{number}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className={`break-words text-[13px] ${isDone && shape.tick ? "text-on-surface-variant line-through" : "text-on-surface"}`}>{task.content}</p>
                  {shape.url && task.url && (
                    <a
                      href={task.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
                    >
                      <Link2 size={12} className="shrink-0" aria-hidden="true" />
                      <span className="min-w-0 truncate">{task.url}</span>
                    </a>
                  )}
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    {shape.numbered && <span className="text-[11px] text-outline">{savedOn(task.createdAt)}</span>}
                    {clientTag && task.addedBy === "client" && (
                      <span className="inline-block rounded-full bg-primary-fixed px-2 py-0.5 text-[10px] font-semibold text-on-primary-fixed-variant">
                        {clientTag}
                      </span>
                    )}
                  </span>
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
                    // What the tab is for is open from the start (the credentials themselves), and so
                    // is a note on a shared link, unless it is long enough to bury the list
                    defaultOpen={(detailsOpen || shape.text?.required) && task.description.length <= PROJECT_DETAILS_OPEN_MAX_CHARS}
                  />
                </div>
              )}
              {task.files.length > 0 && (
                <div className="pl-6">
                  <ItemFiles files={task.files} onPreview={setPreview} />
                </div>
              )}
              {task.voiceNote && <div className="pl-6">{<VoiceNotePlayer task={task} />}</div>}
            </li>
          )
        })}
      </ul>
      {preview && <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />}
    </>
  )
}

/** What a delete asks before it happens, named by the tab the item is on. */
export const deleteItemTitle = (kind: ProjectItemKind) => `Delete this ${projectItemKind(kind).one}?`
export const deleteItemExplains = PROJECT_TASK_MESSAGES.deleteExplains
