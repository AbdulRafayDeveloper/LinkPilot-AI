"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { requestApi } from "@/lib/apiClient"
import { CONTENT_AUTOSAVE_DELAY_MS, CONTENT_DESCRIPTION_MAX_LENGTH, IMPORTANT_CONTENT_ENDPOINT, IMPORTANT_CONTENT_MESSAGES } from "@/constants/importantContent"
import { canKeepalive } from "@/constants/textLimits"
import type { ImportantContent } from "@/types/importantContent"
import type { RecordFolder } from "@/types/folders"
import { ContentFields, contentFormOf, isContentSaveable, type ContentForm } from "./ContentFields"
import { formatInstant } from "@/lib/timeZone"

interface ContentDialogProps {
  // The entry being edited, or null to add a new one
  entry: ImportantContent | null
  // The types already in use, suggested as the user types; any other type is fine too
  knownTypes: string[]
  // The folders the entry can be filed in, from the page's one list; null while they load
  folders: RecordFolder[] | null
  // Closed without the Save button; `changed` when an edit was auto-saved on the way
  onClose: (changed: boolean) => void
  onSaved: (entry: ImportantContent) => void
}

// Where auto-save has got to, shown beside the buttons (an edit only)
type AutoSave = { state: "idle" } | { state: "saving" } | { state: "saved"; at: string } | { state: "failed"; message: string }

const clock = () => formatInstant(Date.now(), { hour: "2-digit", minute: "2-digit" })

/**
 * Add and Edit share one dialog, so editing starts from what was saved. The fields are the shared
 * `ContentFields` (the name, the type, **the folder it goes in**, and the description on a visual
 * page with its own text size): a new entry starts in no folder and goes into whichever is chosen,
 * exactly as Move would file it afterwards, and an edit opens on the folder the entry is in and can
 * change it. The server checks every field again.
 *
 * **An edit saves itself** a moment after each change (CONTENT_AUTOSAVE_DELAY_MS) and says when it
 * last did; Save changes still saves at once and closes, and closing saves anything still waiting.
 * **A new entry never does**: it is created only by Save content, so nothing half-written is added.
 */
export const ContentDialog: React.FC<ContentDialogProps> = ({ entry, knownTypes, folders, onClose, onSaved }) => {
  const [form, setForm] = useState<ContentForm>(() => contentFormOf(entry))
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [autoSave, setAutoSave] = useState<AutoSave>({ state: "idle" })
  const nameRef = useRef<HTMLInputElement>(null)
  const isEdit = entry !== null
  // What the server holds now, and the entry as it last answered, so closing knows whether anything is left
  const savedForm = useRef(JSON.stringify(contentFormOf(entry)))
  const latest = useRef<ImportantContent | null>(entry)
  const changedOnServer = useRef(false)
  const running = useRef<Promise<boolean> | null>(null)
  // The form as the timers and the page-closing save see it, kept in step after every change
  const formRef = useRef(form)
  useEffect(() => {
    formRef.current = form
  }, [form])

  // A message about the last attempt stops being true once the form changes
  const update = <K extends keyof ContentForm>(key: K, value: ContentForm[K]) => {
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
    if (!isEdit || !isContentSaveable(form) || JSON.stringify(form) === savedForm.current) return
    const timer = window.setTimeout(() => void saveEdit(), CONTENT_AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [form, isEdit, saveEdit])

  // Leaving the page with an edit still waiting: sent anyway, as the page goes
  useEffect(() => {
    if (!entry) return
    const flush = () => {
      if (!isDirty() || !isContentSaveable(formRef.current)) return
      const body = JSON.stringify(formRef.current)
      void fetch(`${IMPORTANT_CONTENT_ENDPOINT}/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
        // A description too large for a keepalive body is sent as an ordinary request instead, which
        // the browser may cancel but will not refuse outright (constants/textLimits.ts)
        keepalive: canKeepalive(body),
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
      const ok = isContentSaveable(form) ? await saveEdit() : false
      if (ok && latest.current) onSaved(latest.current)
      else {
        setError(isContentSaveable(form) ? IMPORTANT_CONTENT_MESSAGES.saveFailed : IMPORTANT_CONTENT_MESSAGES.autosaveWaiting)
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
    if (isEdit && isDirty() && isContentSaveable(formRef.current)) {
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
    if (!isContentSaveable(form)) {
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
      description={entry ? entry.name : "A name, the text itself, a type of your own, and the folder it goes in."}
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
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {isSaving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              {isEdit ? "Save changes" : "Save content"}
            </button>
          </div>
        </div>
      }
    >
      <form id="important-content-form" onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
        <ContentFields form={form} onChange={update} knownTypes={knownTypes} folders={folders} nameRef={nameRef} />
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
