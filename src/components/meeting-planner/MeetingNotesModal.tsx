"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, Eye, Loader2, NotebookPen, Pencil, Save } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { RichTextEditor } from "@/components/ui/RichTextEditor"
import { RichTextView } from "@/components/ui/RichTextView"
import { CopyButton } from "@/components/ui/CopyButton"
import { requestApi } from "@/lib/apiClient"
import { canKeepalive } from "@/constants/textLimits"
import {
  MEETING_NOTES_AUTOSAVE_DELAY_MS,
  MEETING_NOTES_MAX_LENGTH,
  MEETING_PLANNER_ENDPOINT,
  MEETING_PLANNER_MESSAGES,
} from "@/constants/meetingPlanner"
import { dayLabel, formatTime } from "@/lib/meetingDates"
import type { MeetingPlan, MeetingPlanDetail } from "@/types/meetingPlanner"

interface MeetingNotesModalProps {
  meeting: MeetingPlan
  // What was last saved on this meeting; the modal starts from it
  notes: string
  onSaved: (meeting: MeetingPlanDetail) => void
  onClose: () => void
}

// Where auto-save has got to, shown in the footer
type AutoSave = { state: "idle" } | { state: "saving" } | { state: "saved"; at: string } | { state: "failed"; message: string }

const clock = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

/**
 * The meeting's notes, in the same large panel the prompt editors open in, because notes on a call
 * are written and read at length rather than glanced at. Two tabs over one text: **Read**, which
 * shows the notes formatted and nothing else, and **Write**, the shared visual editor. A meeting
 * that already has notes opens on Read, so opening it to check something never puts a caret in the
 * middle of what is there; an empty one opens on Write, with nothing to read yet.
 *
 * It saves itself once typing settles, like every other long box in the app, and says so in the
 * footer. Save and Close sends whatever is still waiting first, and leaving the page sends it too.
 */
export const MeetingNotesModal: React.FC<MeetingNotesModalProps> = ({ meeting, notes, onSaved, onClose }) => {
  const [text, setText] = useState(notes)
  const [tab, setTab] = useState<"read" | "write">(notes.trim() ? "read" : "write")
  const [autoSave, setAutoSave] = useState<AutoSave>({ state: "idle" })
  const [isClosing, setIsClosing] = useState(false)
  // What the server holds. It is state, not a ref, because the footer and the buttons read it
  const [savedText, setSavedText] = useState(notes)
  /**
   * The same two values for the save itself and for the flush as the page goes, which run outside
   * render and must not re-subscribe on every keystroke. They are written in effects, never while
   * rendering, so what is on screen and what is saved can never disagree.
   */
  const latest = useRef(text)
  const saved = useRef(notes)
  const running = useRef<Promise<boolean> | null>(null)
  const endpoint = `${MEETING_PLANNER_ENDPOINT}/${meeting.id}/notes`

  useEffect(() => {
    latest.current = text
  }, [text])
  useEffect(() => {
    saved.current = savedText
  }, [savedText])

  /** Sends the notes as they stand. Saves never overlap: a change made meanwhile goes after this one. */
  const save = useCallback(async (): Promise<boolean> => {
    if (running.current) await running.current
    const current = latest.current
    if (current === saved.current) return true
    const attempt = (async () => {
      setAutoSave({ state: "saving" })
      try {
        const { data } = await requestApi<MeetingPlanDetail>(endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: current }),
        })
        saved.current = current
        setSavedText(current)
        onSaved(data)
        setAutoSave({ state: "saved", at: clock() })
        return true
      } catch (reason: unknown) {
        setAutoSave({
          state: "failed",
          message: reason instanceof Error ? reason.message : MEETING_PLANNER_MESSAGES.notesFailed,
        })
        return false
      }
    })()
    running.current = attempt
    const ok = await attempt
    running.current = null
    return ok
  }, [endpoint, onSaved])

  // Typing settles, the notes save
  useEffect(() => {
    if (text === savedText || text.length > MEETING_NOTES_MAX_LENGTH) return
    const timer = window.setTimeout(() => void save(), MEETING_NOTES_AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [text, savedText, save])

  // Leaving the page with a change still waiting: sent anyway, as the page goes
  useEffect(() => {
    const flush = () => {
      if (latest.current === saved.current) return
      const body = JSON.stringify({ notes: latest.current })
      void fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
        // Notes too large for a keepalive body go as an ordinary request, which the browser may
        // cancel but will not refuse outright (constants/textLimits.ts)
        keepalive: canKeepalive(body),
      })
    }
    window.addEventListener("pagehide", flush)
    return () => window.removeEventListener("pagehide", flush)
  }, [endpoint])

  const isDirty = text !== savedText
  const tooLong = text.length > MEETING_NOTES_MAX_LENGTH

  const closeWithSave = async () => {
    if (isClosing) return
    if (!isDirty) {
      onClose()
      return
    }
    setIsClosing(true)
    const ok = await save()
    setIsClosing(false)
    // A failed save keeps the panel open, so nothing written is lost to a closed window
    if (ok) onClose()
  }

  const tabClass = (isActive: boolean) =>
    `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
      isActive ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-container-high"
    }`

  return (
    <Modal
      title="Meeting notes"
      description={`"${meeting.name}" · ${dayLabel(meeting.meetingDate, { weekday: "short", month: "short" })} at ${formatTime(meeting.meetingTime)}`}
      onClose={() => void closeWithSave()}
      isCloseDisabled={isClosing}
      size="large"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex min-h-[20px] items-center gap-1.5 text-xs" aria-live="polite">
            {autoSave.state === "saving" && (
              <>
                <Loader2 size={13} className="animate-spin text-outline" aria-hidden="true" />
                <span className="text-on-surface-variant">Saving...</span>
              </>
            )}
            {autoSave.state === "saved" && !isDirty && (
              <>
                <CheckCircle2 size={13} className="text-success" aria-hidden="true" />
                <span className="text-success">Auto-saved at {autoSave.at}</span>
              </>
            )}
            {autoSave.state === "failed" && (
              <>
                <AlertCircle size={13} className="text-error" aria-hidden="true" />
                <span className="text-error">{autoSave.message}</span>
              </>
            )}
            {tooLong && <span className="text-error">{MEETING_PLANNER_MESSAGES.notesTooLong}</span>}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => void closeWithSave()}
              disabled={isClosing}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={isClosing || !isDirty || tooLong}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isClosing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              Save notes
            </button>
          </div>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-outline-variant bg-surface-container-low p-1">
            <button type="button" onClick={() => setTab("read")} className={tabClass(tab === "read")} aria-pressed={tab === "read"}>
              <Eye size={13} aria-hidden="true" />
              Read
            </button>
            <button type="button" onClick={() => setTab("write")} className={tabClass(tab === "write")} aria-pressed={tab === "write"}>
              <Pencil size={13} aria-hidden="true" />
              Write
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] tabular-nums text-outline">{text.length.toLocaleString()} characters</span>
            {text.trim() && <CopyButton text={text} label="Copy notes" />}
          </div>
        </div>

        {tab === "write" ? (
          <RichTextEditor
            id={`meeting-notes-${meeting.id}`}
            value={text}
            onChange={setText}
            maxLength={MEETING_NOTES_MAX_LENGTH}
            placeholder="What to cover, what was agreed, what to send afterwards..."
            ariaLabel="Meeting notes"
            visual
            fill
          />
        ) : text.trim() ? (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-outline-variant bg-white p-4 sm:p-6">
            <RichTextView text={text} />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-6 text-center">
            <NotebookPen size={22} className="text-outline" aria-hidden="true" />
            <p className="text-sm font-semibold text-on-surface">No notes on this meeting yet</p>
            <p className="max-w-sm text-xs leading-relaxed text-on-surface-variant">
              Write what you want to cover before the call, and what was agreed afterwards. It is kept with this meeting.
            </p>
            <button
              type="button"
              onClick={() => setTab("write")}
              className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant"
            >
              <Pencil size={13} aria-hidden="true" />
              Write notes
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
