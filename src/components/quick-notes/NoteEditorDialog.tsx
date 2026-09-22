"use client"

import React, { useCallback, useEffect, useId, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { RichTextEditor } from "@/components/ui/RichTextEditor"
import { requestApi } from "@/lib/apiClient"
import { NOTE_AUTOSAVE_DELAY_MS, NOTE_MAX_LENGTH, NOTE_TITLE_MAX_LENGTH, QUICK_NOTES_ENDPOINT, QUICK_NOTES_MESSAGES } from "@/constants/quickNotes"
import { NOTE_EDITOR_IMAGES } from "./noteEditorImages"
import type { QuickNote, QuickNoteInput } from "@/types/quickNotes"

type Form = Required<QuickNoteInput>

interface NoteEditorDialogProps {
  note: QuickNote
  // Every save the server confirms, so the list shows the note as it now is
  onSaved: (note: QuickNote) => void
  onClose: () => void
}

// Where auto-save has got to, shown beside the buttons
type AutoSave = { state: "idle" } | { state: "saving" } | { state: "saved"; at: string } | { state: "failed"; message: string }

const formOf = (note: QuickNote): Form => ({ title: note.title, content: note.content })

// What the server would refuse anyway; an edit in this state waits instead of failing every few seconds
const isSaveable = (form: Form) =>
  Boolean(form.content.trim()) && form.content.length <= NOTE_MAX_LENGTH && form.title.length <= NOTE_TITLE_MAX_LENGTH

const clock = () => new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })

const fieldClass =
  "h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[14px] text-on-surface placeholder:text-outline focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25"

/**
 * One saved note, open to edit: an optional title above the shared visual editor, which takes
 * formatting and images (pasted, dropped or picked). **It saves itself** a moment after each change
 * (NOTE_AUTOSAVE_DELAY_MS, the pause Important Content waits) and says when it last did; closing saves
 * anything still waiting, and leaving the page sends it as the page goes. Saves never overlap.
 */
export const NoteEditorDialog: React.FC<NoteEditorDialogProps> = ({ note, onSaved, onClose }) => {
  const [form, setForm] = useState<Form>(() => formOf(note))
  const [autoSave, setAutoSave] = useState<AutoSave>({ state: "idle" })
  const [isClosing, setIsClosing] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const contentId = useId()
  // What the server holds now, so a save is only sent when something really changed
  const savedForm = useRef(JSON.stringify(formOf(note)))
  const running = useRef<Promise<boolean> | null>(null)
  // The form as the timers and the page-closing save see it, kept in step after every change
  const formRef = useRef(form)
  useEffect(() => {
    formRef.current = form
  }, [form])

  const update = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }))

  const isDirty = () => JSON.stringify(formRef.current) !== savedForm.current

  /** Sends the note as it stands. A change made while a save runs is sent after it. */
  const save = useCallback(async (): Promise<boolean> => {
    if (running.current) await running.current
    const body = JSON.stringify(formRef.current)
    if (body === savedForm.current) return true
    const attempt = (async () => {
      setAutoSave({ state: "saving" })
      try {
        const { data } = await requestApi<QuickNote>(`${QUICK_NOTES_ENDPOINT}/${note.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body,
        })
        savedForm.current = body
        onSaved(data)
        setAutoSave({ state: "saved", at: clock() })
        return true
      } catch (reason: unknown) {
        setAutoSave({ state: "failed", message: reason instanceof Error ? reason.message : QUICK_NOTES_MESSAGES.autosaveFailed })
        return false
      }
    })()
    running.current = attempt
    const ok = await attempt
    running.current = null
    return ok
  }, [note.id, onSaved])

  // Saves once typing settles
  useEffect(() => {
    if (!isSaveable(form) || JSON.stringify(form) === savedForm.current) return
    const timer = window.setTimeout(() => void save(), NOTE_AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [form, save])

  // Leaving the page with an edit still waiting: sent anyway, as the page goes
  useEffect(() => {
    const flush = () => {
      if (!isDirty() || !isSaveable(formRef.current)) return
      void fetch(`${QUICK_NOTES_ENDPOINT}/${note.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formRef.current),
        keepalive: true,
      })
    }
    window.addEventListener("pagehide", flush)
    return () => window.removeEventListener("pagehide", flush)
  }, [note.id])

  /** Closing saves what is still waiting first; if that fails, the dialog stays open and says so. */
  const close = async () => {
    if (isClosing) return
    if (isDirty() && isSaveable(formRef.current)) {
      setIsClosing(true)
      const ok = await save()
      setIsClosing(false)
      if (!ok) return
    }
    onClose()
  }

  const status = (() => {
    if (!isSaveable(form)) {
      return (
        <span className="inline-flex items-center gap-1.5 text-on-secondary-fixed-variant">
          <Clock size={14} aria-hidden="true" />
          {form.content.trim() ? QUICK_NOTES_MESSAGES.contentTooLong : QUICK_NOTES_MESSAGES.autosaveWaiting}
        </span>
      )
    }
    switch (autoSave.state) {
      case "saving":
        return (
          <span className="inline-flex items-center gap-1.5 text-on-surface-variant">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            {QUICK_NOTES_MESSAGES.autosaving}
          </span>
        )
      case "saved":
        return (
          <span className="inline-flex items-center gap-1.5 font-semibold text-success">
            <CheckCircle2 size={14} aria-hidden="true" />
            {QUICK_NOTES_MESSAGES.autosaved(autoSave.at)}
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

  const overLimit = form.content.length > NOTE_MAX_LENGTH

  return (
    <Modal
      title="Edit note"
      description={note.title || "A title is optional."}
      onClose={() => void close()}
      isCloseDisabled={isClosing}
      initialFocusRef={titleRef}
      size="editor"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" aria-live="polite" className="min-w-0 text-[12px]">
            {status}
          </p>
          <button
            type="button"
            onClick={() => void close()}
            disabled={isClosing}
            className="ml-auto inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
          >
            {isClosing && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            Close
          </button>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <label className="flex shrink-0 flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-on-surface">
            Title <span className="font-normal text-outline">(optional)</span>
          </span>
          <input
            ref={titleRef}
            value={form.title}
            maxLength={NOTE_TITLE_MAX_LENGTH}
            onChange={(event) => update("title", event.target.value)}
            placeholder="e.g. Staging server steps"
            autoComplete="off"
            className={fieldClass}
          />
        </label>
        {/* Not a <label> around the field: the toolbar's buttons can't sit inside one */}
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-2">
            <label htmlFor={contentId} className="text-[13px] font-semibold text-on-surface">
              Note
            </label>
            <span className={`text-[11px] ${overLimit ? "font-semibold text-error" : "text-outline"}`}>
              {form.content.length.toLocaleString()} / {NOTE_MAX_LENGTH.toLocaleString()}
            </span>
          </span>
          <RichTextEditor
            id={contentId}
            value={form.content}
            maxLength={NOTE_MAX_LENGTH}
            onChange={(value) => update("content", value)}
            rows={12}
            placeholder="Write, paste or drop anything: text, links, lists, images."
            ariaLabel="Note"
            visual
            fill
            images={NOTE_EDITOR_IMAGES}
          />
        </div>
      </div>
    </Modal>
  )
}
