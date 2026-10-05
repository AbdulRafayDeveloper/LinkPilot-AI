"use client"

import React, { useState } from "react"
import { Loader2, Plus, X } from "lucide-react"
import { TaskDetailsFields } from "@/components/tasks/TaskDetailsFields"
import { VoiceNoteField } from "./VoiceNoteField"
import { PROJECT_TASK_MAX_LENGTH, PROJECT_TASK_MESSAGES, projectItemKind, type ProjectItemKind } from "@/constants/clientProjectTasks"
import { emptyTaskDetails, toStoredImages, type TaskDetailsDraft } from "@/types/taskAttachment"
import type { ProjectTask, ProjectTaskInput, VoiceNoteView } from "@/types/clientProjectTasks"

interface TaskComposerProps {
  // The item being changed, or null when one is being added
  task: ProjectTask | null
  // Which tab it goes on, which decides the wording and is sent with a new item
  kind: ProjectItemKind
  onSave: (input: ProjectTaskInput) => Promise<void>
  onCancel?: () => void
  disabled?: boolean
  canAttach?: boolean
  // Where an image and a recording are sent, for a page whose reader has no account (a shared link)
  imageEndpoint?: string
  voiceEndpoint?: string
}

/**
 * Writing one item: its line, the details it carries (a description and images, the shared fields
 * Daily Tasks and the plan editor use, so dropping, pasting and picking an image all behave the
 * same) and one voice note.
 *
 * One form adds an item and edits one, on all three tabs and on both surfaces, so none of them can
 * drift from the others. The tab only changes the words and where a new item lands; a client
 * writing from a shared link fills in exactly the same form the owner does.
 */
export const TaskComposer: React.FC<TaskComposerProps> = ({ task, kind, onSave, onCancel, disabled, canAttach = true, imageEndpoint, voiceEndpoint }) => {
  const [content, setContent] = useState(task?.content ?? "")
  const [details, setDetails] = useState<TaskDetailsDraft>(
    task ? { description: task.description, images: task.images, uploading: 0 } : emptyTaskDetails()
  )
  const [voiceNote, setVoiceNote] = useState<VoiceNoteView | null>(task?.voiceNote ?? null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isEdit = task !== null
  const words = projectItemKind(kind)
  const canSave = Boolean(content.trim()) && details.uploading === 0 && !isSaving && !disabled

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    setIsSaving(true)
    setError(null)
    try {
      await onSave({
        content,
        description: details.description,
        images: toStoredImages(details.images),
        voiceNote: voiceNote ? { assetId: voiceNote.assetId, contentType: voiceNote.contentType, seconds: voiceNote.seconds } : null,
        kind,
      })
      if (!isEdit) {
        // Adding leaves the form ready for the next one; editing closes itself
        setContent("")
        setDetails(emptyTaskDetails())
        setVoiceNote(null)
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : PROJECT_TASK_MESSAGES.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3">
      <div>
        <label htmlFor={`task-${task?.id ?? "new"}`} className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-outline">
          {isEdit ? words.one : words.addLabel}
        </label>
        <input
          id={`task-${task?.id ?? "new"}`}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={PROJECT_TASK_MAX_LENGTH}
          disabled={disabled || isSaving}
          placeholder={words.placeholder}
          className="h-10 w-full rounded-xl border border-outline-variant bg-white px-3 text-[13px] text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
        />
      </div>

      <TaskDetailsFields
        idPrefix={`project-task-${task?.id ?? "new"}`}
        details={details}
        onChange={setDetails}
        onError={setError}
        disabled={disabled || isSaving}
        canAttachImage={canAttach}
        alwaysOpen={isEdit}
        imageEndpoint={imageEndpoint}
      />

      <VoiceNoteField
        note={voiceNote}
        onChange={setVoiceNote}
        onError={setError}
        disabled={disabled || isSaving}
        canRecord={canAttach}
        endpoint={voiceEndpoint}
      />

      {error && (
        <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-2 text-[13px] font-semibold text-on-surface hover:bg-surface-container-high"
          >
            <X size={14} aria-hidden="true" />
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!canSave}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
          {isEdit ? "Save" : words.addLabel}
        </button>
      </div>
      {details.uploading > 0 && <p className="text-right text-[11px] text-outline">Waiting for {details.uploading} image(s) to finish uploading...</p>}
    </form>
  )
}
