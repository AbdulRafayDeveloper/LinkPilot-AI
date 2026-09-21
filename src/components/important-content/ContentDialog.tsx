"use client"

import React, { useCallback, useEffect, useId, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { RichTextEditor, type RichTextImages } from "@/components/ui/RichTextEditor"
import { requestApi } from "@/lib/apiClient"
import { CONTENT_IMAGES_ENDPOINT } from "@/lib/contentImages"
import {
  CONTENT_AUTOSAVE_DELAY_MS,
  CONTENT_DESCRIPTION_MAX_LENGTH,
  CONTENT_IMAGE_ACCEPT,
  CONTENT_IMAGE_MAX_BYTES,
  CONTENT_NAME_MAX_LENGTH,
  CONTENT_TEXT_SIZES,
  CONTENT_TYPE_MAX_LENGTH,
  DEFAULT_CONTENT_TEXT_SIZE,
  IMPORTANT_CONTENT_ENDPOINT,
  IMPORTANT_CONTENT_MESSAGES,
} from "@/constants/importantContent"
import type { ImportantContent, ImportantContentInput } from "@/types/importantContent"

const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[14px] text-on-surface focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25"
const labelClass = "text-[13px] font-semibold text-on-surface"

type Form = Required<ImportantContentInput>

interface ContentDialogProps {
  // The entry being edited, or null to add a new one
  entry: ImportantContent | null
  // The types already in use, suggested as the user types; any other type is fine too
  knownTypes: string[]
  // Closed without the Save button; `changed` when an edit was auto-saved on the way
  onClose: (changed: boolean) => void
  onSaved: (entry: ImportantContent) => void
}

// Where auto-save has got to, shown beside the buttons (an edit only)
type AutoSave = { state: "idle" } | { state: "saving" } | { state: "saved"; at: string } | { state: "failed"; message: string }

const formOf = (entry: ImportantContent | null): Form =>
  entry
    ? { name: entry.name, description: entry.description, type: entry.type, textSize: entry.textSize ?? DEFAULT_CONTENT_TEXT_SIZE }
    : { name: "", description: "", type: "", textSize: DEFAULT_CONTENT_TEXT_SIZE }

// What the server would refuse anyway; an edit in this state waits instead of failing every few seconds
const isSaveable = (form: Form) => Boolean(form.name.trim() && form.type.trim()) && form.description.length <= CONTENT_DESCRIPTION_MAX_LENGTH

const clock = () => new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })

/** Stores one picture through the app and answers the address the description names it by. */
async function uploadImage(file: File): Promise<string> {
  const { data } = await requestApi<{ src: string }>(CONTENT_IMAGES_ENDPOINT, { method: "POST", headers: { "Content-Type": file.type }, body: file }, { retry: true })
  return data.src
}

const IMAGES: RichTextImages = {
  accept: CONTENT_IMAGE_ACCEPT,
  maxBytes: CONTENT_IMAGE_MAX_BYTES,
  upload: uploadImage,
  messages: {
    unsupported: IMPORTANT_CONTENT_MESSAGES.imageUnsupported,
    tooLarge: IMPORTANT_CONTENT_MESSAGES.imageTooLarge,
    failed: IMPORTANT_CONTENT_MESSAGES.imageUploadFailed,
    badAddress: IMPORTANT_CONTENT_MESSAGES.imageBadAddress,
  },
}

/**
 * Add and Edit share one dialog, so editing starts from what was saved. The description is written on
 * a visual page (images, headings, lists, a text size of its own), and a Markdown tab shows the same
 * text as marks. The type is free text: the types already used are only suggestions. The server
 * checks every field again.
 *
 * **An edit saves itself** a moment after each change (CONTENT_AUTOSAVE_DELAY_MS) and says when it
 * last did; Save changes still saves at once and closes, and closing saves anything still waiting.
 * **A new entry never does**: it is created only by Save content, so nothing half-written is added.
 */
export const ContentDialog: React.FC<ContentDialogProps> = ({ entry, knownTypes, onClose, onSaved }) => {
  const [form, setForm] = useState<Form>(() => formOf(entry))
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [autoSave, setAutoSave] = useState<AutoSave>({ state: "idle" })
  const nameRef = useRef<HTMLInputElement>(null)
  const typeListId = useId()
  const descriptionId = useId()
  const isEdit = entry !== null
  // What the server holds now, and the entry as it last answered, so closing knows whether anything is left
  const savedForm = useRef(JSON.stringify(formOf(entry)))
  const latest = useRef<ImportantContent | null>(entry)
  const changedOnServer = useRef(false)
  const running = useRef<Promise<boolean> | null>(null)
  // The form as the timers and the page-closing save see it, kept in step after every change
  const formRef = useRef(form)
  useEffect(() => {
    formRef.current = form
  }, [form])

  // A message about the last attempt stops being true once the form changes
  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setError(null)
  }

  const isDirty = () => JSON.stringify(formRef.current) !== savedForm.current

  /** Sends the edit as it stands. Saves never overlap: a change made meanwhile is sent after this one. */
  const saveEdit = useCallback(async (): Promise<boolean> => {
    if (!entry) return false
    if (running.current) await running.current
    const current = formRef.current
    const body = JSON.stringify(current)
    if (body === savedForm.current) return true
    const attempt = (async () => {
      setAutoSave({ state: "saving" })
      try {
        const { data } = await requestApi<ImportantContent>(`${IMPORTANT_CONTENT_ENDPOINT}/${entry.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body,
        })
        savedForm.current = body
        latest.current = data
        changedOnServer.current = true
        setAutoSave({ state: "saved", at: clock() })
        return true
      } catch (reason: unknown) {
        setAutoSave({ state: "failed", message: reason instanceof Error ? reason.message : IMPORTANT_CONTENT_MESSAGES.autosaveFailed })
        return false
      }
    })()
    running.current = attempt
    const ok = await attempt
    running.current = null
    return ok
  }, [entry])

  // An edit saves itself once typing settles; a new entry waits for Save content
  useEffect(() => {
    if (!isEdit || !isSaveable(form) || JSON.stringify(form) === savedForm.current) return
    const timer = window.setTimeout(() => void saveEdit(), CONTENT_AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [form, isEdit, saveEdit])

  // Leaving the page with an edit still waiting: sent anyway, as the page goes
  useEffect(() => {
    if (!entry) return
    const flush = () => {
      if (!isDirty() || !isSaveable(formRef.current)) return
      void fetch(`${IMPORTANT_CONTENT_ENDPOINT}/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formRef.current),
        keepalive: true,
      })
    }
    window.addEventListener("pagehide", flush)
    return () => window.removeEventListener("pagehide", flush)
  }, [entry])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    if (isEdit) {
      const ok = isSaveable(form) ? await saveEdit() : false
      if (ok && latest.current) onSaved(latest.current)
      else {
        setError(isSaveable(form) ? IMPORTANT_CONTENT_MESSAGES.saveFailed : IMPORTANT_CONTENT_MESSAGES.autosaveWaiting)
        setIsSaving(false)
      }
      return
    }
    try {
      const { data } = await requestApi<ImportantContent>(
        IMPORTANT_CONTENT_ENDPOINT,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) },
        { idempotent: true }
      )
      onSaved(data)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : IMPORTANT_CONTENT_MESSAGES.saveFailed)
      setIsSaving(false)
    }
  }

  /** Closing an edit saves what is still waiting first; if that fails, the dialog stays open and says so. */
  const close = async () => {
    if (isSaving) return
    if (isEdit && isDirty() && isSaveable(formRef.current)) {
      setIsSaving(true)
      const ok = await saveEdit()
      setIsSaving(false)
      if (!ok) return
    }
    onClose(changedOnServer.current)
  }

  const status = (() => {
    if (!isEdit) return null
    // A blank name or type is never what the server holds, so the edit is waiting on it
    if (!isSaveable(form)) {
      return (
        <span className="inline-flex items-center gap-1.5 text-on-secondary-fixed-variant">
          <Clock size={14} aria-hidden="true" />
          {IMPORTANT_CONTENT_MESSAGES.autosaveWaiting}
        </span>
      )
    }
    switch (autoSave.state) {
      case "saving":
        return (
          <span className="inline-flex items-center gap-1.5 text-on-surface-variant">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            {IMPORTANT_CONTENT_MESSAGES.autosaving}
          </span>
        )
      case "saved":
        return (
          <span className="inline-flex items-center gap-1.5 font-semibold text-success">
            <CheckCircle2 size={14} aria-hidden="true" />
            {IMPORTANT_CONTENT_MESSAGES.autosaved(autoSave.at)}
          </span>
        )
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 text-error">
            <AlertCircle size={14} aria-hidden="true" />
            {autoSave.message}
          </span>
        )
      default:
        return <span className="text-outline">Changes save themselves as you type.</span>
    }
  })()

  const overLimit = form.description.length > CONTENT_DESCRIPTION_MAX_LENGTH

  return (
    <Modal
      title={entry ? "Edit content" : "Add new content"}
      description={entry ? entry.name : "A name, the text itself, and a type of your own."}
      onClose={() => void close()}
      isCloseDisabled={isSaving}
      initialFocusRef={nameRef}
      size="editor"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" aria-live="polite" className="min-w-0 text-[12px]">
            {status}
          </p>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => void close()}
              disabled={isSaving}
              className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
            >
              {isEdit ? "Close" : "Cancel"}
            </button>
            <button
              type="submit"
              form="important-content-form"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
            >
              {isSaving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              {isEdit ? "Save changes" : "Save content"}
            </button>
          </div>
        </div>
      }
    >
      <form id="important-content-form" onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
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
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-2">
            <label htmlFor={descriptionId} className={labelClass}>
              Description <span className="font-normal text-outline">(optional)</span>
            </label>
            <span className={`text-[11px] ${overLimit ? "font-semibold text-error" : "text-outline"}`}>
              {form.description.length.toLocaleString()} / {CONTENT_DESCRIPTION_MAX_LENGTH.toLocaleString()}
            </span>
          </span>
          <RichTextEditor
            id={descriptionId}
            value={form.description}
            maxLength={CONTENT_DESCRIPTION_MAX_LENGTH}
            onChange={(value) => update("description", value)}
            rows={12}
            placeholder="The text you want to keep: a login, a link, steps, anything. Use the buttons above for headings, lists, images and more."
            ariaLabel="Description"
            visual
            fill
            images={IMAGES}
            textSize={{ value: form.textSize, steps: CONTENT_TEXT_SIZES, onChange: (size) => update("textSize", size) }}
          />
        </div>
        {(error || overLimit) && (
          <p role="alert" className="flex shrink-0 gap-2 rounded-xl bg-error-container px-3 py-2.5 text-[13px] text-error">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error ?? IMPORTANT_CONTENT_MESSAGES.descriptionTooLong}
          </p>
        )}
      </form>
    </Modal>
  )
}
