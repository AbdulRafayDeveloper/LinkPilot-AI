"use client"

import React, { useState } from "react"
import { Loader2, Save } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import type { MeetingPlan } from "@/types/meetingPlanner"
import { describeSeries } from "./SeriesBadge"
import { TimeField } from "./TimeField"

interface MoveMeetingModalProps {
  meeting: MeetingPlan
  isSaving: boolean
  error: string | null
  onSubmit: (meetingDate: string, meetingTime: string) => void
  onClose: () => void
}

const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
const labelClass = "mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-outline"

/**
 * Moving one meeting to another day or time, straight from the calendar's day list. For a meeting in
 * a repeating series it moves this occurrence only; the rest of the series stays where it is.
 * Everything else about the meeting is edited on its own page.
 */
export const MoveMeetingModal: React.FC<MoveMeetingModalProps> = ({ meeting, isSaving, error, onSubmit, onClose }) => {
  const [meetingDate, setMeetingDate] = useState(meeting.meetingDate)
  const [meetingTime, setMeetingTime] = useState(meeting.meetingTime)
  const series = describeSeries(meeting)
  const isUnchanged = meetingDate === meeting.meetingDate && meetingTime === meeting.meetingTime

  return (
    <Modal
      title="Change the day or time"
      description={series ? `"${meeting.name}" repeats (${series}). Only this meeting moves.` : `"${meeting.name}"`}
      onClose={() => {
        if (!isSaving) onClose()
      }}
      isCloseDisabled={isSaving}
      size="compact"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p role="alert" className="min-h-[20px] text-xs text-error">
            {error}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSubmit(meetingDate, meetingTime)}
              disabled={isSaving || isUnchanged || !meetingDate}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              {isSaving ? "Saving..." : series ? "Move this meeting" : "Save"}
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="move-meeting-date" className={labelClass}>
            Date
          </label>
          <input
            id="move-meeting-date"
            type="date"
            value={meetingDate}
            onChange={(event) => setMeetingDate(event.target.value)}
            disabled={isSaving}
            className={fieldClass}
          />
        </div>
        <TimeField value={meetingTime} onChange={setMeetingTime} disabled={isSaving} labelClass={labelClass} />
      </div>
    </Modal>
  )
}
