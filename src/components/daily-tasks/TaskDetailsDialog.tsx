"use client"

import React, { useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { TaskDetailsFields } from "@/components/tasks/TaskDetailsFields"
import { DAILY_TASKS_MESSAGES } from "@/constants/dailyTasks"
import type { DailyTask } from "@/types/dailyTasks"
import type { TaskDetailsDraft, TaskImage } from "@/types/taskAttachment"

interface TaskDetailsDialogProps {
  task: DailyTask
  // Saves the description and the image; rejects with the reason when it fails, and the popup stays open
  onSave: (details: { description: string; image: TaskImage | null }) => Promise<void>
  onClose: () => void
}

// The draft starts from what the task already carries, so the popup opens showing it
const draftOf = (task: DailyTask): TaskDetailsDraft => ({
  description: task.description,
  file: null,
  image: task.image ? { assetId: task.image.assetId, contentType: task.image.contentType } : null,
})

/**
 * Adds or changes the description and the image on a task already written, the way the plan
 * editor in Employees Management does for a plan's tasks. It is a popup rather than something
 * opened inside the row, because the whole row of a daily task is what drags it: a text box or an
 * image picker in there would start a drag at the first press.
 *
 * The fields are the shared `TaskDetailsFields`, so writing a description and choosing, dragging
 * or pasting an image work exactly as they do when a task is first written. Nothing is saved until
 * Save is pressed, and Save waits for an image that is still uploading.
 */
export const TaskDetailsDialog: React.FC<TaskDetailsDialogProps> = ({ task, onSave, onClose }) => {
  const [details, setDetails] = useState<TaskDetailsDraft>(() => draftOf(task))
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // An image is uploading from the moment it is chosen until its id comes back
  const isUploading = Boolean(details.file && !details.image)
  const saved = draftOf(task)
  const isChanged = details.description.trim() !== saved.description.trim() || details.image?.assetId !== saved.image?.assetId

  const save = async () => {
    if (isSaving || isUploading || !isChanged) return
    setIsSaving(true)
    setSaveError(null)
    try {
      await onSave({ description: details.description.trim(), image: details.image })
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : DAILY_TASKS_MESSAGES.detailsFailed)
      setIsSaving(false)
    }
  }

  const error = fieldError ?? saveError

  return (
    <Modal
      title={task.description || task.image ? "Task details" : "Add details"}
      description={task.content}
      onClose={onClose}
      isCloseDisabled={isSaving}
      size="compact"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-[20px] text-xs" aria-live="polite">
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={isSaving || isUploading || !isChanged}
              title={isUploading ? "Wait for the image to finish uploading" : undefined}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving || isUploading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
              {isSaving ? "Saving..." : isUploading ? "Uploading..." : "Save details"}
            </button>
          </div>
        </div>
      }
    >
      <TaskDetailsFields
        idPrefix={`task-details-${task.id}`}
        details={details}
        onChange={(next) => {
          setDetails(next)
          setSaveError(null)
        }}
        onError={setFieldError}
        disabled={isSaving}
        savedImageUrl={task.image?.url ?? null}
        alwaysOpen
      />
    </Modal>
  )
}
