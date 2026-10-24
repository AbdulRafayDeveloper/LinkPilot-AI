"use client"

import React, { useState } from "react"
import { Link2, Loader2, Plus, X } from "lucide-react"
import { TaskDetailsFields } from "@/components/tasks/TaskDetailsFields"
import { VoiceNoteField } from "./VoiceNoteField"
import { ProjectFilesField } from "./ProjectFilesField"
import { itemProblem } from "@/lib/projectItems"
import {
  DEFAULT_PROJECT_PRIORITY,
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_MAX_IMAGES,
  PROJECT_TASK_MAX_LENGTH,
  PROJECT_TASK_MESSAGES,
  PROJECT_URL_MAX_LENGTH,
  projectItemKind,
  type ProjectItemKind,
  type ProjectPriority,
} from "@/constants/clientProjectTasks"
import { EstimateField, PrioritySelect, ShareToggle, StageField, defaultStage } from "./ItemFields"
import { emptyTaskDetails, toStoredImages, type TaskDetailsDraft } from "@/types/taskAttachment"
import type { ProjectEstimate, ProjectFileView, ProjectTask, ProjectTaskInput, VoiceNoteView } from "@/types/clientProjectTasks"
import type { RoadmapStage } from "@/constants/clientProjectTasks"

interface TaskComposerProps {
  // The item being changed, or null when one is being added
  task: ProjectTask | null
  // Which tab it goes on, which decides what the form holds and is sent with a new item
  kind: ProjectItemKind
  onSave: (input: ProjectTaskInput) => Promise<void>
  onCancel?: () => void
  disabled?: boolean
  canAttach?: boolean
  // Where an image, a recording and a file are sent, for a page whose reader has no account
  imageEndpoint?: string
  voiceEndpoint?: string
  fileEndpoint: string
}

const labelClass = "mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-outline"
const fieldClass =
  "h-10 w-full rounded-xl border border-outline-variant bg-white px-3 text-[13px] text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"

/**
 * Writing one item, on any tab and on either surface.
 *
 * **The tab decides what the form holds**, through that kind's `shape` in
 * `constants/clientProjectTasks.ts`: a change carries a description, images, files and a voice note;
 * a credential carries the credentials themselves; a link carries a web address; a document and a
 * backup carry the file, and may be saved with nothing typed, taking the file's own name.
 *
 * One form adds an item and edits one, so neither can drift from the other, and a client writing
 * from a shared link fills in exactly the form the owner does. What may be saved is `itemProblem`,
 * the same rule the schema and the service ask, so the button is never offered for something the
 * server would refuse, and what is missing is said rather than left to be guessed.
 */
export const TaskComposer: React.FC<TaskComposerProps> = ({
  task,
  kind,
  onSave,
  onCancel,
  disabled,
  canAttach = true,
  imageEndpoint,
  voiceEndpoint,
  fileEndpoint,
}) => {
  const [content, setContent] = useState(task?.content ?? "")
  const [url, setUrl] = useState(task?.url ?? "")
  const [details, setDetails] = useState<TaskDetailsDraft>(
    task ? { description: task.description, images: task.images, uploading: 0 } : emptyTaskDetails()
  )
  const [voiceNote, setVoiceNote] = useState<VoiceNoteView | null>(task?.voiceNote ?? null)
  const [files, setFiles] = useState<ProjectFileView[]>(task?.files ?? [])
  // How urgent it is, on every tab, and how long it takes, on the one tab that asks
  const [priority, setPriority] = useState<ProjectPriority>(task?.priority ?? DEFAULT_PROJECT_PRIORITY)
  const [estimate, setEstimate] = useState<ProjectEstimate | null>(task?.estimate ?? null)
  // Where a roadmap item has got to, and whether the client may read a note
  const [stage, setStage] = useState<RoadmapStage>(task?.stage ?? defaultStage())
  const [isShared, setIsShared] = useState(task?.isClientVisible ?? false)
  // Files still going up, so the item is never saved without one of them
  const [sending, setSending] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isEdit = task !== null
  const words = projectItemKind(kind)
  const shape = words.shape
  const problem = itemProblem(kind, { content, description: details.description, url, files })
  const isEmpty = !content.trim() && !details.description.trim() && !url.trim() && files.length === 0 && details.images.length === 0 && !voiceNote
  const canSave = !problem && details.uploading === 0 && sending === 0 && !isSaving && !disabled

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    setIsSaving(true)
    setError(null)
    try {
      await onSave({
        content,
        description: details.description,
        url,
        images: toStoredImages(details.images),
        files: files.map((file) => ({
          assetId: file.assetId,
          name: file.name,
          contentType: file.contentType,
          category: file.category,
          size: file.size,
        })),
        voiceNote: voiceNote ? { assetId: voiceNote.assetId, contentType: voiceNote.contentType, seconds: voiceNote.seconds } : null,
        kind,
        priority,
        estimate: shape.estimate ? estimate : null,
        // Only the tab that has one sends it, so nothing carries a field its tab never shows
        ...(shape.stage ? { stage } : {}),
        ...(shape.shareable ? { isClientVisible: isShared } : {}),
      })
      if (!isEdit) {
        // Adding leaves the form ready for the next one; editing closes itself
        setContent("")
        setUrl("")
        setDetails(emptyTaskDetails())
        setVoiceNote(null)
        setFiles([])
        setPriority(DEFAULT_PROJECT_PRIORITY)
        setEstimate(null)
        setStage(defaultStage())
        setIsShared(false)
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : PROJECT_TASK_MESSAGES.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  const fieldId = `task-${task?.id ?? "new"}-${kind}`

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3">
      <div>
        <label htmlFor={fieldId} className={labelClass}>
          {isEdit ? words.one : words.addLabel}{" "}
          {shape.nameFromFile && <span className="normal-case tracking-normal">(optional, the file&apos;s own name is used)</span>}
        </label>
        <input
          id={fieldId}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={PROJECT_TASK_MAX_LENGTH}
          disabled={disabled || isSaving}
          placeholder={words.placeholder}
          className={fieldClass}
        />
      </div>

      {shape.url && (
        <div>
          <label htmlFor={`${fieldId}-url`} className={labelClass}>
            Web address
          </label>
          <div className="flex items-center gap-2">
            <Link2 size={14} className="shrink-0 text-outline" aria-hidden="true" />
            <input
              id={`${fieldId}-url`}
              /**
               * Plain text, not `type="url"`. The browser's own rule for a url field needs a scheme,
               * so it silently refused to submit the form for "example.com" with nothing but a
               * tooltip; the app's rule adds `https://` to exactly that, which is what anyone
               * pasting an address expects, and `itemProblem` is what says when it is not one.
               */
              type="text"
              inputMode="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              maxLength={PROJECT_URL_MAX_LENGTH}
              disabled={disabled || isSaving}
              placeholder="https://example.com/the-page"
              className={fieldClass}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <span className={labelClass}>{PROJECT_TASK_MESSAGES.priority}</span>
          <PrioritySelect
            value={priority}
            onChange={setPriority}
            disabled={disabled || isSaving}
            label={content.trim() || words.one}
            className="h-10 px-3 text-[11px]"
          />
        </div>
        {shape.estimate && (
          <EstimateField estimate={estimate} onChange={setEstimate} disabled={disabled || isSaving} idPrefix={fieldId} />
        )}
        {shape.stage && <StageField stage={stage} onChange={setStage} disabled={disabled || isSaving} />}
        {shape.shareable && (
          <div>
            <span className={labelClass}>{PROJECT_TASK_MESSAGES.visibility}</span>
            <ShareToggle isShared={isShared} onChange={setIsShared} disabled={disabled || isSaving} label={content.trim() || words.one} />
            <p className="mt-1 text-[11px] text-outline">{PROJECT_TASK_MESSAGES.shareHint}</p>
          </div>
        )}
      </div>

      {shape.text && (
        <TaskDetailsFields
          idPrefix={`project-task-${task?.id ?? "new"}-${kind}`}
          details={details}
          onChange={setDetails}
          onError={setError}
          disabled={disabled || isSaving}
          canAttachImage={canAttach && shape.talk}
          showImages={shape.talk}
          // What is written is the point of the tab (the credentials), so it is open from the start
          alwaysOpen={isEdit || shape.text.required}
          textLabel={shape.text.label}
          textHint={shape.text.hint}
          textRequired={shape.text.required}
          imageEndpoint={imageEndpoint}
          maxImages={PROJECT_MAX_IMAGES}
          maxDescription={PROJECT_DESCRIPTION_MAX_LENGTH}
        />
      )}

      {shape.files !== "none" && (
        <ProjectFilesField
          files={files}
          onAdd={(file) => setFiles((current) => [...current, file])}
          onRemove={(assetId) => setFiles((current) => current.filter((file) => file.assetId !== assetId))}
          onError={setError}
          onUploading={setSending}
          endpoint={fileEndpoint}
          disabled={disabled || isSaving}
          canAttach={canAttach}
        />
      )}

      {shape.talk && (
        <VoiceNoteField
          note={voiceNote}
          onChange={setVoiceNote}
          onError={setError}
          disabled={disabled || isSaving}
          canRecord={canAttach}
          endpoint={voiceEndpoint}
        />
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {/* What is still missing, once something has been written: the button is already off for it */}
        {problem && !isEmpty && <p className="mr-auto text-[11px] text-outline">{problem}</p>}
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
      {sending > 0 && <p className="text-right text-[11px] text-outline">{PROJECT_TASK_MESSAGES.filesUploading}</p>}
    </form>
  )
}
