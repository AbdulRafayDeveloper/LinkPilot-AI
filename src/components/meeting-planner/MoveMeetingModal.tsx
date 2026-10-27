"use client"

import React, { useState } from "react"
import { Loader2, Save } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { RadioCardGroup } from "@/components/ui/RadioCardGroup"
import type { UpdateScopeId } from "@/constants/meetingPlanner"
import type { MeetingPlan } from "@/types/meetingPlanner"
import { describeSeries } from "./SeriesBadge"
import { TimeField } from "./TimeField"

interface MoveMeetingModalProps {
  meeting: MeetingPlan
  isSaving: boolean
  error: string | null
  onSubmit: (meetingDate: string, meetingTime: string, scope: UpdateScopeId) => void
  onClose: () => void
}

const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
const labelClass = "mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-outline"

/**
 * Which meetings of a series a new day or time applies to. Only a repeating meeting is asked, and
 * "This meeting only" is what the modal has always done, so it stays the one chosen.
 */
const SCOPE_OPTIONS = [
  { id: "one" as const, label: "This meeting only", description: "The rest of the series stays where it is" },
  { id: "series" as const, label: "This and every later one", description: "The new time becomes the series' time" },
]

/**
 * Moving a meeting to another day or time, straight from the calendar's day list. A one-off meeting
 * simply moves. A meeting in a repeating series is asked which meetings it means: this one alone,
 * which is what it always did, or this one and every later meeting of the series, which is how the
 * time is changed for good. Meetings already past are never touched either way: their time is a
 * record of when they happened. Everything else about a meeting is edited on its own page.
 */
export const MoveMeetingModal: React.FC<MoveMeetingModalProps> = ({ meeting, isSaving, error, onSubmit, onClose }) => {
  const [meetingDate, setMeetingDate] = useState(meeting.meetingDate)
  const [meetingTime, setMeetingTime] = useState(meeting.meetingTime)
  const [scope, setScope] = useState<UpdateScopeId>("one")
  const series = describeSeries(meeting)
  const isUnchanged = meetingDate === meeting.meetingDate && meetingTime === meeting.meetingTime
  const dayMoved = meetingDate !== meeting.meetingDate

  return (
    <Modal
      title="Change the day or time"
      description={series ? `"${meeting.name}" repeats (${series}).` : `"${meeting.name}"`}
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
              onClick={() => onSubmit(meetingDate, meetingTime, series ? scope : "one")}
              disabled={isSaving || isUnchanged || !meetingDate}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              {isSaving ? "Saving..." : !series ? "Save" : scope === "series" ? "Change the whole series" : "Move this meeting"}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
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

        {series && (
          <>
            <RadioCardGroup
              name="move-meeting-scope"
              legend="Apply to"
              options={SCOPE_OPTIONS}
              value={scope}
              onChange={setScope}
              disabled={isSaving}
            />
            {/* Moving the day of a whole series shifts every later meeting by the same number of
                days, so a weekly meeting stays weekly on its new day rather than piling onto one. */}
            {scope === "series" && dayMoved && (
              <p className="rounded-xl border border-secondary/40 bg-secondary-fixed px-3 py-2.5 text-[12px] leading-relaxed text-on-secondary-fixed-variant">
                Every later meeting moves by the same number of days, so the series keeps its rhythm on the new day.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
