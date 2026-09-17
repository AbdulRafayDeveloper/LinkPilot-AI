"use client"

import React, { useState } from "react"
import { Loader2, MessageSquarePlus, Pencil, Trash2 } from "lucide-react"
import { EMPLOYEE_MESSAGES, PLAN_REASON_MAX_LENGTH } from "@/constants/employees"

interface TaskReasonProps {
  reason: string
  // The task these words are about, for the labels a screen reader reads out
  taskText: string
  // A finished task has nothing to explain, so it is never asked for a reason
  isDone: boolean
  // Given, the reason can be written, changed and taken back; without it, it only reads
  onSave?: (reason: string) => Promise<void>
}

/**
 * Why a task wasn't finished, in the employee's own words. It shows in amber under the task, the
 * colour this app uses for something needing attention, so it stands out from the task itself
 * without reading as an error. The employee writes it on their link; the manager's page and the
 * history show the same words without the buttons to change them.
 */
export const TaskReason: React.FC<TaskReasonProps> = ({ reason, taskText, isDone, onSave }) => {
  const [draft, setDraft] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (value: string) => {
    if (!onSave) return
    setIsSaving(true)
    setError(null)
    try {
      await onSave(value.trim())
      setDraft(null)
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : EMPLOYEE_MESSAGES.reasonFailed)
    } finally {
      setIsSaving(false)
    }
  }

  if (draft !== null) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void save(draft)
        }}
        className="mt-1.5 flex flex-col gap-1.5 rounded-lg border border-secondary/40 bg-secondary-fixed/50 p-2"
      >
        <label className="text-[11px] font-bold uppercase tracking-wider text-on-secondary-fixed-variant">
          Why isn&apos;t this done?
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={PLAN_REASON_MAX_LENGTH}
            rows={2}
            autoFocus
            placeholder="Waiting on the client's reply..."
            aria-label={`Why "${taskText}" isn't done`}
            className="mt-1 w-full resize-y rounded-lg border border-outline-variant bg-white px-2.5 py-2 text-[14px] font-normal normal-case tracking-normal text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </label>
        {error && (
          <p role="alert" className="text-[12px] text-error">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft(null)
              setError(null)
            }}
            disabled={isSaving}
            className="rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-on-primary-fixed-variant disabled:opacity-60"
          >
            {isSaving && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
            Save reason
          </button>
        </div>
      </form>
    )
  }

  if (reason) {
    return (
      <div className="mt-1.5 flex flex-wrap items-start gap-x-2 gap-y-1 rounded-lg border border-secondary/40 bg-secondary-fixed/50 px-2.5 py-1.5">
        <p className="min-w-0 flex-1 break-words text-[13px] leading-relaxed text-on-secondary-fixed-variant">
          <span className="font-bold">Not done: </span>
          {reason}
        </p>
        {onSave && (
          <span className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => setDraft(reason)}
              aria-label={`Change why "${taskText}" isn't done`}
              title="Change this reason"
              className="flex h-7 w-7 items-center justify-center rounded-md text-on-secondary-fixed-variant hover:bg-white/70"
            >
              <Pencil size={13} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void save("")}
              disabled={isSaving}
              aria-label={`Remove why "${taskText}" isn't done`}
              title="Remove this reason"
              className="flex h-7 w-7 items-center justify-center rounded-md text-on-secondary-fixed-variant hover:bg-error/10 hover:text-error disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Trash2 size={13} aria-hidden="true" />}
            </button>
          </span>
        )}
        {error && (
          <p role="alert" className="w-full text-[12px] text-error">
            {error}
          </p>
        )}
      </div>
    )
  }

  if (!onSave || isDone) return null

  return (
    <button
      type="button"
      onClick={() => setDraft("")}
      className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[12px] font-semibold text-on-surface-variant transition-colors hover:bg-secondary-fixed hover:text-on-secondary-fixed-variant"
    >
      <MessageSquarePlus size={13} aria-hidden="true" />
      Add a reason
    </button>
  )
}
