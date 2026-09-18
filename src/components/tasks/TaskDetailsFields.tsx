"use client"

import React, { useEffect, useId, useRef, useState } from "react"
import { ChevronDown, Loader2, Paperclip, Trash2 } from "lucide-react"
import { ImageDropzone } from "@/components/post-input/ImageDropzone"
import { uploadTaskImage } from "@/lib/taskImageUpload"
import { TASK_ATTACHMENT_MESSAGES, TASK_DESCRIPTION_MAX_LENGTH } from "@/constants/taskAttachments"
import { hasTaskDetails, type TaskDetailsDraft } from "@/types/taskAttachment"

interface TaskDetailsFieldsProps {
  // Unique within the page, so several open details areas never share a field id
  idPrefix: string
  details: TaskDetailsDraft
  onChange: (details: TaskDetailsDraft) => void
  onError: (message: string | null) => void
  disabled?: boolean
  // Off when file storage isn't set up: the description still works, the image says why it can't
  canAttachImage?: boolean
  /**
   * The link to an image already saved on this task, for a task being edited rather than written.
   * The picker only previews a file just chosen, so without this an image that is already there
   * would look as though it had gone.
   */
  savedImageUrl?: string | null
  /**
   * Open from the start with no toggle, for a place that exists only to edit the details (the
   * Daily Tasks details popup). Off by default, so a list of tasks still opens them on request.
   */
  alwaysOpen?: boolean
}

const labelClass = "mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-outline"

/**
 * The optional detail a task can carry, written the same way wherever a task is created: a
 * description, and one image chosen by browsing, dragging or pasting (the shared ImageDropzone).
 *
 * It is closed until it is asked for, so writing a quick list of tasks is untouched by it, and a
 * task that already carries something opens showing it. The image is uploaded as soon as it is
 * chosen, so by the time the task is saved there is only an id to save with it.
 */
export const TaskDetailsFields: React.FC<TaskDetailsFieldsProps> = ({
  idPrefix,
  details,
  onChange,
  onError,
  disabled = false,
  canAttachImage = true,
  savedImageUrl = null,
  alwaysOpen = false,
}) => {
  const fieldId = useId()
  const [isOpen, setIsOpen] = useState(() => alwaysOpen || hasTaskDetails(details))
  const [isUploading, setIsUploading] = useState(false)
  const descriptionId = `${idPrefix}-${fieldId}-description`
  const imageId = `${idPrefix}-${fieldId}-image`
  const panelId = `${idPrefix}-${fieldId}-panel`
  // The details as they are now. An upload takes a few seconds, and what is typed in that time, or
  // an image removed before it lands, must not be undone when it finishes, so the upload's result is
  // applied to the latest details rather than to the ones it started from
  const latest = useRef(details)
  useEffect(() => {
    latest.current = details
  })
  // An image already saved shows as it is until it is removed or a new file is chosen in its place
  const showSaved = Boolean(savedImageUrl && details.image && !details.file)

  const selectImage = async (file: File) => {
    onError(null)
    // Shown straight away, so the picker has its preview while the bytes are still going up
    onChange({ ...details, file, image: null })
    setIsUploading(true)
    try {
      const image = await uploadTaskImage(file)
      // Only while this file is still the one chosen: removed or replaced meanwhile, it is left alone
      if (latest.current.file === file) onChange({ ...latest.current, file, image })
    } catch (error: unknown) {
      if (latest.current.file === file) onChange({ ...latest.current, file: null, image: null })
      onError(error instanceof Error ? error.message : TASK_ATTACHMENT_MESSAGES.uploadFailed)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="flex flex-col">
      {!alwaysOpen && (
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          disabled={disabled}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11px] font-semibold text-outline transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-50"
        >
          <Paperclip size={12} aria-hidden="true" />
          {isOpen ? TASK_ATTACHMENT_MESSAGES.hideDetails : TASK_ATTACHMENT_MESSAGES.addDetails}
          {!isOpen && hasTaskDetails(details) && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="This task has details" />}
          <ChevronDown size={12} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      )}

      {isOpen && (
        <div id={panelId} className={`${alwaysOpen ? "" : "mt-2 "}flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3`}>
          <div>
            <label htmlFor={descriptionId} className={labelClass}>
              {TASK_ATTACHMENT_MESSAGES.descriptionLabel} <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              id={descriptionId}
              value={details.description}
              onChange={(event) => onChange({ ...details, description: event.target.value })}
              maxLength={TASK_DESCRIPTION_MAX_LENGTH}
              disabled={disabled}
              rows={3}
              placeholder={TASK_ATTACHMENT_MESSAGES.descriptionHint}
              className="w-full resize-y rounded-xl border border-outline-variant bg-white px-3 py-2.5 text-[13px] leading-relaxed text-on-surface placeholder:text-outline focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            />
            <p className="mt-1 text-[11px] text-outline">
              {details.description.length.toLocaleString()} / {TASK_DESCRIPTION_MAX_LENGTH.toLocaleString()}
            </p>
          </div>

          <div>
            <span className={labelClass}>
              {TASK_ATTACHMENT_MESSAGES.imageLabel} <span className="normal-case tracking-normal">(optional)</span>
            </span>
            {canAttachImage ? (
              showSaved ? (
                <div className="flex items-center gap-3 rounded-xl border border-outline-variant bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={savedImageUrl as string} alt="The image on this task" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ ...details, file: null, image: null })
                      onError(null)
                    }}
                    disabled={disabled}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:border-error/40 hover:text-error disabled:opacity-50"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                    Remove image
                  </button>
                </div>
              ) : (
              <>
                <ImageDropzone
                  inputId={imageId}
                  file={details.file}
                  onSelect={(file) => void selectImage(file)}
                  onRemove={() => {
                    onChange({ ...details, file: null, image: null })
                    onError(null)
                  }}
                  onReject={onError}
                  disabled={disabled || isUploading}
                  compact
                />
                {isUploading && (
                  <p role="status" className="mt-1.5 flex items-center gap-1.5 text-[11px] text-on-surface-variant">
                    <Loader2 size={12} className="animate-spin text-primary" aria-hidden="true" />
                    Uploading the image...
                  </p>
                )}
              </>
              )
            ) : (
              <p className="rounded-xl border border-dashed border-outline-variant px-3 py-4 text-center text-[12px] text-on-surface-variant">
                {TASK_ATTACHMENT_MESSAGES.storageUnavailable}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
