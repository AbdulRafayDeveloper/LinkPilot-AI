"use client"

import React, { useId, useRef, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { RichTextEditor } from "@/components/ui/RichTextEditor"
import { requestApi } from "@/lib/apiClient"
import {
  CONTENT_DESCRIPTION_MAX_LENGTH,
  CONTENT_NAME_MAX_LENGTH,
  CONTENT_TYPE_MAX_LENGTH,
  IMPORTANT_CONTENT_ENDPOINT,
  IMPORTANT_CONTENT_MESSAGES,
} from "@/constants/importantContent"
import type { ImportantContent, ImportantContentInput } from "@/types/importantContent"

const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[14px] text-on-surface focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25"
const labelClass = "text-[13px] font-semibold text-on-surface"

interface ContentDialogProps {
  // The entry being edited, or null to add a new one
  entry: ImportantContent | null
  // The types already in use, suggested as the user types; any other type is fine too
  knownTypes: string[]
  onClose: () => void
  onSaved: (entry: ImportantContent) => void
}

/**
 * Add and Edit share one dialog, so editing starts from what was saved. The type is free text:
 * the types already used are only suggestions. The server checks every field again.
 */
export const ContentDialog: React.FC<ContentDialogProps> = ({ entry, knownTypes, onClose, onSaved }) => {
  const [form, setForm] = useState<ImportantContentInput>(entry ? { name: entry.name, description: entry.description, type: entry.type } : { name: "", description: "", type: "" })
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const typeListId = useId()
  const descriptionId = useId()
  // A message about the last attempt stops being true once the form changes
  const update = (key: keyof ImportantContentInput, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setError(null)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      const { data } = await requestApi<ImportantContent>(entry ? `${IMPORTANT_CONTENT_ENDPOINT}/${entry.id}` : IMPORTANT_CONTENT_ENDPOINT, {
        method: entry ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }, { idempotent: true })
      onSaved(data)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : IMPORTANT_CONTENT_MESSAGES.saveFailed)
      setIsSaving(false)
    }
  }

  return (
    <Modal
      title={entry ? "Edit content" : "Add new content"}
      description={entry ? entry.name : "A name, the text itself, and a type of your own."}
      onClose={onClose}
      isCloseDisabled={isSaving}
      initialFocusRef={nameRef}
      footer={
        <div className="flex justify-end gap-2">
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
            form="important-content-form"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
          >
            {isSaving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            {entry ? "Save changes" : "Save content"}
          </button>
        </div>
      }
    >
      <form id="important-content-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Name</span>
            <input
              ref={nameRef}
              name="name"
              value={form.name}
              maxLength={CONTENT_NAME_MAX_LENGTH}
              onChange={(event) => update("name", event.target.value)}
              placeholder="e.g. Acme staging login"
              className={`${fieldClass} h-10`}
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Type</span>
            <input
              name="type"
              value={form.type}
              maxLength={CONTENT_TYPE_MAX_LENGTH}
              onChange={(event) => update("type", event.target.value)}
              list={typeListId}
              placeholder="e.g. Credentials"
              autoComplete="off"
              className={`${fieldClass} h-10`}
              required
            />
            <datalist id={typeListId}>
              {knownTypes.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </label>
        </div>
        {/* Not a <label> around the field: the toolbar's buttons can't sit inside one */}
        <div className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-2">
            <label htmlFor={descriptionId} className={labelClass}>
              Description <span className="font-normal text-outline">(optional)</span>
            </label>
            <span className="text-[11px] text-outline">
              {form.description.length.toLocaleString()} / {CONTENT_DESCRIPTION_MAX_LENGTH.toLocaleString()}
            </span>
          </span>
          <RichTextEditor
            id={descriptionId}
            value={form.description}
            maxLength={CONTENT_DESCRIPTION_MAX_LENGTH}
            onChange={(value) => update("description", value)}
            rows={12}
            placeholder="The text you want to keep: a login, a link, steps, anything. Use the buttons above for bold, lists and more."
          />
        </div>
        {error && (
          <p role="alert" className="flex gap-2 rounded-xl bg-error-container px-3 py-2.5 text-[13px] text-error">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
