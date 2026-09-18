"use client"

import React, { useState } from "react"
import { Check, Loader2, NotebookPen, Pencil, X } from "lucide-react"
import { RichTextEditor } from "@/components/ui/RichTextEditor"
import { RichTextView } from "@/components/ui/RichTextView"
import { CopyButton } from "@/components/ui/CopyButton"
import { requestApi } from "@/lib/apiClient"
import { MEETINGS_ENDPOINT } from "@/constants/meetings"
import { MEETING_NOTES_MAX_LENGTH, RECORDING_MESSAGES } from "@/constants/meetingRecording"
import type { Meeting } from "@/types/meetings"

/**
 * The meeting's notes: written from the analysis, then the user's to change. Once edited, a new
 * analysis leaves them alone, which the page says so the user knows why they didn't change.
 */
export const MeetingNotesPanel: React.FC<{ meeting: Meeting; onSaved: (meeting: Meeting) => void }> = ({ meeting, onSaved }) => {
  const [draft, setDraft] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (draft === null) return
    setIsSaving(true)
    setError(null)
    try {
      const { data } = await requestApi<Meeting>(`${MEETINGS_ENDPOINT}/${meeting.id}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: draft }),
      })
      onSaved(data)
      setDraft(null)
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : RECORDING_MESSAGES.notesFailed)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-on-surface">
          <NotebookPen size={16} className="text-primary" aria-hidden="true" />
          Meeting notes
          <span className="font-normal text-outline">{meeting.notesEditedAt ? "· edited by you" : "· written from the analysis"}</span>
        </h2>
        {draft === null ? (
          <div className="flex items-center gap-1">
            <CopyButton text={meeting.notes} label="Copy the notes" showLabel />
            <button
              type="button"
              onClick={() => setDraft(meeting.notes)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
            >
              <Pencil size={13} aria-hidden="true" />
              Edit
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDraft(null)}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
            >
              <X size={13} aria-hidden="true" />
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
            >
              {isSaving ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}
              Save notes
            </button>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
          {error}
        </p>
      )}
      {draft === null ? (
        <RichTextView text={meeting.notes} />
      ) : (
        <RichTextEditor id={`meeting-notes-${meeting.id}`} value={draft} onChange={setDraft} maxLength={MEETING_NOTES_MAX_LENGTH} rows={14} ariaLabel="Meeting notes" />
      )}
    </section>
  )
}
