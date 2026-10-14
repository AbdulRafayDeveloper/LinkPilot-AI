"use client"

import React, { useEffect, useRef, useState } from "react"
import { AlertCircle, FileKey2, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { ContentFields, contentFormOf, isContentSaveable, type ContentForm } from "@/components/important-content/ContentFields"
import { usePromptFolders } from "@/hooks/usePromptFolders"
import { requestApi } from "@/lib/apiClient"
import { CONTENT_DESCRIPTION_MAX_LENGTH, IMPORTANT_CONTENT_ENDPOINT, IMPORTANT_CONTENT_MESSAGES } from "@/constants/importantContent"
import { CONTENT_FOLDERS_ENDPOINT } from "@/constants/contentFolders"
import { QUICK_NOTES_ENDPOINT, QUICK_NOTES_MESSAGES } from "@/constants/quickNotes"
import type { ImportantContentPage } from "@/types/importantContent"
import type { MovedNote, QuickNote } from "@/types/quickNotes"

interface MoveNoteDialogProps {
  note: QuickNote
  // The entry it became, with the server's own word on whether the note left Quick Notes
  onMoved: (moved: MovedNote, message: string) => void
  onClose: () => void
}

/**
 * Takes one Quick Note into Important Content. The fields are Important Content's own
 * (`ContentFields`), so what is asked here is exactly what Add new content asks: the note's name
 * fills the Name, the note's text fills the description and can still be changed, the **type is
 * required** and has to be given, and the folder dropdown starts on No folder. Nothing is written
 * until the button is pressed, and the server saves the entry and deletes the note in one request.
 */
export const MoveNoteDialog: React.FC<MoveNoteDialogProps> = ({ note, onMoved, onClose }) => {
  const [form, setForm] = useState<ContentForm>(() => ({ ...contentFormOf(null), name: note.title, description: note.content }))
  const [knownTypes, setKnownTypes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  // Important Content's own folders, the list its Add dialog offers
  const folders = usePromptFolders(CONTENT_FOLDERS_ENDPOINT)

  // The types already in use come with Important Content's first page; without them the field still takes any type
  useEffect(() => {
    const controller = new AbortController()
    requestApi<ImportantContentPage>(`${IMPORTANT_CONTENT_ENDPOINT}?page=1`, { signal: controller.signal })
      .then(({ data }) => setKnownTypes(data.types))
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  const update = <K extends keyof ContentForm>(key: K, value: ContentForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setError(null)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSaving) return
    if (!isContentSaveable(form)) {
      setError(form.description.length > CONTENT_DESCRIPTION_MAX_LENGTH ? IMPORTANT_CONTENT_MESSAGES.descriptionTooLong : !form.name.trim() ? IMPORTANT_CONTENT_MESSAGES.missingName : IMPORTANT_CONTENT_MESSAGES.missingType)
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const { data, message } = await requestApi<MovedNote>(
        `${QUICK_NOTES_ENDPOINT}/${note.id}/move`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) },
        { idempotent: true }
      )
      onMoved(data, message || QUICK_NOTES_MESSAGES.moved(data.entry.name))
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : QUICK_NOTES_MESSAGES.moveFailed)
      setIsSaving(false)
    }
  }

  return (
    <Modal
      title="Move to Important Content"
      description={QUICK_NOTES_MESSAGES.moveExplains}
      onClose={onClose}
      isCloseDisabled={isSaving}
      initialFocusRef={nameRef}
      size="editor"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="move-note-form"
            disabled={isSaving}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <FileKey2 size={15} aria-hidden="true" />}
            {isSaving ? "Moving..." : "Move to Important Content"}
          </button>
        </div>
      }
    >
      <form id="move-note-form" onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
        <ContentFields form={form} onChange={update} knownTypes={knownTypes} folders={folders.folders} nameRef={nameRef} />
        {(error || folders.error) && (
          <p role="alert" className="flex shrink-0 gap-2 rounded-xl bg-error-container px-3 py-2.5 text-[13px] text-error">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error ?? folders.error}
          </p>
        )}
      </form>
    </Modal>
  )
}
