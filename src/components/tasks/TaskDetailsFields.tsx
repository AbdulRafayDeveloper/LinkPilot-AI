"use client"

import React, { useEffect, useId, useRef, useState } from "react"
import { ChevronDown, ImageOff, ImagePlus, Loader2, Paperclip, Sparkles, X } from "lucide-react"
import { RichTextEditor } from "@/components/ui/RichTextEditor"
import { uploadTaskImage } from "@/lib/taskImageUpload"
import { TASK_ATTACHMENT_MESSAGES, TASK_DESCRIPTION_MAX_LENGTH, TASK_IMAGE_TYPES, TASK_MAX_IMAGES } from "@/constants/taskAttachments"
import { hasTaskDetails, type TaskDetailsDraft, type TaskImageView } from "@/types/taskAttachment"

interface TaskDetailsFieldsProps {
  // Unique within the page, so several open details areas never share a field id
  idPrefix: string
  details: TaskDetailsDraft
  onChange: (details: TaskDetailsDraft) => void
  onError: (message: string | null) => void
  disabled?: boolean
  // Off when file storage isn't set up: the description still works, the images say why they can't
  canAttachImage?: boolean
  /**
   * Open from the start with no toggle, for a place that exists only to edit the details (the task
   * editor). Off by default, so a list of tasks still opens them on request.
   */
  alwaysOpen?: boolean
  /**
   * Writes the description with AI and answers the text, which replaces what is written. Absent where
   * there is nothing to write about yet (no task line).
   */
  onGenerate?: () => Promise<string>
}

const labelClass = "mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-outline"

/** One image on the task, as a thumbnail with its own remove button. */
const Thumbnail: React.FC<{ image: TaskImageView; label: string; onRemove: () => void; disabled: boolean }> = ({ image, label, onRemove, disabled }) => {
  const [hasFailed, setHasFailed] = useState(false)
  return (
    <li className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-outline-variant bg-white">
      {hasFailed || !image.url ? (
        // A link that has expired in a draft kept overnight: the image is still saved with the task
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] text-outline">
          <ImageOff size={16} aria-hidden="true" />
          Image kept
        </span>
      ) : (
        // A short-lived signed link on the storage host, like every other stored image here, so a plain img
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.url} alt={label} onError={() => setHasFailed(true)} className="h-full w-full object-cover" />
      )}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${label}`}
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-on-surface shadow-sm transition-colors hover:bg-error hover:text-white disabled:opacity-50"
      >
        <X size={13} aria-hidden="true" />
      </button>
    </li>
  )
}

/**
 * The optional detail a task can carry, written the same way wherever a task is created or edited:
 * a formatted description (the shared visual editor: bold, italic, lists, links, with a Markdown view
 * behind it) and up to TASK_MAX_IMAGES images, chosen by browsing, dropping or pasting, each shown as
 * a thumbnail. A "Write with AI" button fills the description from the task's line when offered.
 *
 * It is closed until it is asked for, so a list of tasks reads as a list of lines whether or not they
 * carry details; the button says what is there ("Details (description, 2 images)"). Only an editor
 * whose whole subject is the details opens it by itself, with `alwaysOpen`. Images are uploaded the moment they are chosen,
 * through the app, so by the time the task is saved there is only an id to save with each one;
 * `uploading` counts the ones still on their way.
 */
export const TaskDetailsFields: React.FC<TaskDetailsFieldsProps> = ({
  idPrefix,
  details,
  onChange,
  onError,
  disabled = false,
  canAttachImage = true,
  alwaysOpen = false,
  onGenerate,
}) => {
  const fieldId = useId()
  // Closed even on a task that already carries details, so a plan reads as a list of lines; the
  // button says what is there, and the editor that is only about the details passes `alwaysOpen`
  const [isOpen, setIsOpen] = useState(() => alwaysOpen)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDropping, setIsDropping] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const descriptionId = `${idPrefix}-${fieldId}-description`
  const panelId = `${idPrefix}-${fieldId}-panel`
  // The details as they are now. An upload takes a few seconds, and what is typed in that time, or
  // an image removed meanwhile, must not be undone when it finishes, so each result is applied to
  // the latest details rather than to the ones it started from
  const latest = useRef(details)
  useEffect(() => {
    latest.current = details
  })
  const update = (change: (current: TaskDetailsDraft) => TaskDetailsDraft) => {
    latest.current = change(latest.current)
    onChange(latest.current)
  }

  const room = TASK_MAX_IMAGES - details.images.length - details.uploading

  const addFiles = async (files: File[]) => {
    onError(null)
    const images = files.filter((file) => file.type.startsWith("image/"))
    if (images.length === 0) return
    if (images.length > room) onError(TASK_ATTACHMENT_MESSAGES.tooManyImages)
    const taken = images.slice(0, Math.max(0, room))
    const refused = taken.filter((file) => !TASK_IMAGE_TYPES.includes(file.type))
    if (refused.length > 0) onError(TASK_ATTACHMENT_MESSAGES.unsupportedImage)
    const sending = taken.filter((file) => TASK_IMAGE_TYPES.includes(file.type))
    if (sending.length === 0) return
    update((current) => ({ ...current, uploading: current.uploading + sending.length }))
    await Promise.all(
      sending.map(async (file) => {
        try {
          const image = await uploadTaskImage(file)
          update((current) => ({ ...current, images: [...current.images, image], uploading: Math.max(0, current.uploading - 1) }))
        } catch (error: unknown) {
          update((current) => ({ ...current, uploading: Math.max(0, current.uploading - 1) }))
          onError(error instanceof Error ? error.message : TASK_ATTACHMENT_MESSAGES.uploadFailed)
        }
      })
    )
  }

  const generate = async () => {
    if (!onGenerate || isGenerating) return
    onError(null)
    setIsGenerating(true)
    try {
      const text = await onGenerate()
      update((current) => ({ ...current, description: text }))
    } catch (error: unknown) {
      onError(error instanceof Error ? error.message : TASK_ATTACHMENT_MESSAGES.generateFailed)
    } finally {
      setIsGenerating(false)
    }
  }

  const count = details.images.length + details.uploading

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
          {isOpen ? TASK_ATTACHMENT_MESSAGES.hideDetails : hasTaskDetails(details) ? TASK_ATTACHMENT_MESSAGES.showDetails : TASK_ATTACHMENT_MESSAGES.addDetails}
          {!isOpen && hasTaskDetails(details) && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="This task has details" />}
          <ChevronDown size={12} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      )}

      {isOpen && (
        <div
          id={panelId}
          className={`${alwaysOpen ? "" : "mt-2 "}flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3`}
        >
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor={descriptionId} className="text-[10px] font-bold uppercase tracking-wider text-outline">
                {TASK_ATTACHMENT_MESSAGES.descriptionLabel} <span className="normal-case tracking-normal">(optional)</span>
              </label>
              {onGenerate && (
                <button
                  type="button"
                  onClick={() => void generate()}
                  disabled={disabled || isGenerating}
                  title="Write the description from the task's own line; what is written now is built on"
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-primary/30 bg-primary-fixed/40 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary-fixed disabled:opacity-60"
                >
                  {isGenerating ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Sparkles size={12} aria-hidden="true" />}
                  {isGenerating ? TASK_ATTACHMENT_MESSAGES.generating : TASK_ATTACHMENT_MESSAGES.generate}
                </button>
              )}
            </div>
            <div className="bg-white">
              <RichTextEditor
                id={descriptionId}
                value={details.description}
                onChange={(description) => update((current) => ({ ...current, description }))}
                maxLength={TASK_DESCRIPTION_MAX_LENGTH}
                rows={4}
                placeholder={TASK_ATTACHMENT_MESSAGES.descriptionHint}
                ariaLabel={TASK_ATTACHMENT_MESSAGES.descriptionLabel}
                visual
                compact
              />
            </div>
            <p className={`mt-1 text-[11px] ${details.description.length > TASK_DESCRIPTION_MAX_LENGTH ? "font-semibold text-error" : "text-outline"}`}>
              {details.description.length.toLocaleString()} / {TASK_DESCRIPTION_MAX_LENGTH.toLocaleString()}
            </p>
          </div>

          <div
            onDragOver={(event) => {
              if (!canAttachImage || disabled) return
              event.preventDefault()
              setIsDropping(true)
            }}
            onDragLeave={() => setIsDropping(false)}
            onDrop={(event) => {
              setIsDropping(false)
              if (!canAttachImage || disabled) return
              event.preventDefault()
              void addFiles([...event.dataTransfer.files])
            }}
            onPaste={(event) => {
              const files = [...event.clipboardData.files]
              if (!canAttachImage || disabled || !files.some((file) => file.type.startsWith("image/"))) return
              event.preventDefault()
              void addFiles(files)
            }}
            className={`rounded-xl transition-colors ${isDropping ? "bg-primary-fixed/30 outline outline-2 outline-dashed outline-primary/50" : ""}`}
          >
            <span className={labelClass}>
              {TASK_ATTACHMENT_MESSAGES.imagesLabel}{" "}
              <span className="normal-case tracking-normal">
                (optional, {count} of {TASK_MAX_IMAGES})
              </span>
            </span>
            {canAttachImage ? (
              <ul className="flex flex-wrap gap-2" aria-label="Images on this task">
                {details.images.map((image, index) => (
                  <Thumbnail
                    key={image.assetId}
                    image={image}
                    label={`image ${index + 1}`}
                    disabled={disabled}
                    onRemove={() => {
                      onError(null)
                      update((current) => ({ ...current, images: current.images.filter((entry) => entry.assetId !== image.assetId) }))
                    }}
                  />
                ))}
                {Array.from({ length: details.uploading }, (_, index) => (
                  <li key={`uploading-${index}`} role="status" className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-primary/40 text-[10px] text-on-surface-variant">
                    <Loader2 size={16} className="animate-spin text-primary" aria-hidden="true" />
                    Uploading
                  </li>
                ))}
                {room > 0 && (
                  <li>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={disabled}
                      title="Choose images, or drop or paste them here"
                      className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-outline-variant bg-white text-[10px] font-semibold text-on-surface-variant transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
                    >
                      <ImagePlus size={18} aria-hidden="true" />
                      {TASK_ATTACHMENT_MESSAGES.addImages}
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept={TASK_IMAGE_TYPES.join(",")}
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        const files = [...(event.target.files ?? [])]
                        event.target.value = ""
                        void addFiles(files)
                      }}
                    />
                  </li>
                )}
              </ul>
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
