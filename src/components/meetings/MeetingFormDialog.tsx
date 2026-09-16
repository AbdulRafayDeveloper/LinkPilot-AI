"use client"

import React, { useRef, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { MEETING_MESSAGES, MEETING_TITLE_MAX_LENGTH, TRANSCRIPT_MAX_LENGTH } from "@/constants/meetings"
import type { Meeting, MeetingInput } from "@/types/meetings"

interface MeetingFormDialogProps {
  // The meeting being edited, or null when creating a new one
  meeting: Meeting | null
  isSaving: boolean
  error: string | null
  onSave: (input: MeetingInput) => void
  onClose: () => void
}

const labelClass = "text-[10px] font-bold uppercase tracking-wider text-outline"
const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[13px] text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"

/**
 * Creates a meeting or edits one. The name is optional when creating: left empty, the analysis
 * writes one from what the meeting was about. The transcript box takes a whole meeting, however
 * long, and only counts its characters rather than working over the text as it is typed.
 */
export const MeetingFormDialog: React.FC<MeetingFormDialogProps> = ({ meeting, isSaving, error, onSave, onClose }) => {
  const [title, setTitle] = useState(meeting && !meeting.isTitleGenerated ? meeting.title : "")
  const [transcript, setTranscript] = useState(meeting?.transcript ?? "")
  const [problem, setProblem] = useState<string | null>(null)
  const transcriptRef = useRef<HTMLTextAreaElement>(null)
  const isEdit = meeting !== null
  const willNeedReanalysis = isEdit && transcript !== meeting.transcript && meeting.analysis !== null

  const submit = () => {
    if (isSaving) return
    if (!transcript.trim()) {
      setProblem(MEETING_MESSAGES.missingTranscript)
      transcriptRef.current?.focus()
      return
    }
    setProblem(null)
    onSave({ title: title.trim() || undefined, transcript })
  }

  return (
    <Modal
      title={isEdit ? "Edit meeting" : "New meeting"}
      description={
        isEdit
          ? "Change the name or the notes. Changing the notes means the analysis has to run again."
          : "Paste the whole meeting. A name is optional: without one, the analysis writes a title from what was discussed."
      }
      onClose={onClose}
      isCloseDisabled={isSaving}
      size="large"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-[20px] text-xs" aria-live="polite">
            {problem || error ? (
              <p role="alert" className="text-error">
                {problem ?? error}
              </p>
            ) : willNeedReanalysis ? (
              <p className="text-on-surface-variant">The current analysis will be marked out of date and can be run again.</p>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              {isSaving ? "Saving..." : isEdit ? "Save changes" : "Save meeting"}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="meeting-title" className={labelClass}>
            Meeting name (optional)
          </label>
          <input
            id="meeting-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={MEETING_TITLE_MAX_LENGTH}
            disabled={isSaving}
            placeholder="e.g. Upload planning call with Clinicly"
            className={`${fieldClass} py-2.5`}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="meeting-transcript" className={labelClass}>
              Meeting notes or transcript
            </label>
            <span className="text-[11px] text-outline">
              {transcript.length.toLocaleString()} / {TRANSCRIPT_MAX_LENGTH.toLocaleString()} characters
            </span>
          </div>
          <textarea
            id="meeting-transcript"
            ref={transcriptRef}
            value={transcript}
            onChange={(event) => {
              setTranscript(event.target.value)
              if (problem) setProblem(null)
            }}
            maxLength={TRANSCRIPT_MAX_LENGTH}
            disabled={isSaving}
            spellCheck={false}
            placeholder="Paste the whole meeting here, however long it is. Speaker names and timestamps help, but plain notes work too."
            className={`${fieldClass} min-h-[320px] flex-1 resize-none py-3 font-code text-[12px] leading-relaxed`}
          />
        </div>
      </div>
    </Modal>
  )
}
