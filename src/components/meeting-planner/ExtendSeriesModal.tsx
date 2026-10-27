"use client"

import React, { useState } from "react"
import { CalendarPlus, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { MEETING_PLANNER_MESSAGES, RECURRENCE_MAX_OCCURRENCES } from "@/constants/meetingPlanner"
import { datesAfter } from "@/lib/meetingRecurrence"
import { dayLabel } from "@/lib/meetingDates"
import type { MeetingPlanDetail } from "@/types/meetingPlanner"
import { describeSeries } from "./SeriesBadge"

interface ExtendSeriesModalProps {
  meeting: MeetingPlanDetail
  isSaving: boolean
  error: string | null
  onSubmit: (count: number) => void
  onClose: () => void
}

const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
const labelClass = "mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-outline"

/**
 * Makes a repeating meeting run for longer, from whichever meeting of it is open. The number is how
 * many meetings should follow **this one**, so what already follows counts towards it: asking for 8
 * from the second of four weeks adds the six that are missing. Nothing is ever removed here, so a
 * number smaller than the series simply changes nothing; a meeting is dropped by deleting it.
 */
export const ExtendSeriesModal: React.FC<ExtendSeriesModalProps> = ({ meeting, isSaving, error, onSubmit, onClose }) => {
  // How many meetings of the series already come after this one, which the page knows from its count
  const following = Math.max(0, (meeting.seriesSize ?? 1) - 1)
  const [count, setCount] = useState(Math.min(following + 4, RECURRENCE_MAX_OCCURRENCES))
  const series = describeSeries(meeting)
  const missing = Math.max(0, count - following)
  // What will be added, shown from the meeting the series currently ends on
  const addedDates = missing > 0 && meeting.recurrencePattern
    ? datesAfter(meeting.recurrenceUntil ?? meeting.meetingDate, meeting.recurrencePattern, missing)
    : []
  const shortDay = (date: string) => dayLabel(date, { weekday: "short", month: "short" })

  return (
    <Modal
      title="Repeat it for longer"
      description={`"${meeting.name}"${series ? ` repeats ${series.toLowerCase()}` : ""}.`}
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
              onClick={() => onSubmit(count)}
              disabled={isSaving || missing === 0}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <CalendarPlus size={16} aria-hidden="true" />
              )}
              {isSaving ? "Saving..." : missing > 0 ? `Add ${missing} ${missing === 1 ? "meeting" : "meetings"}` : "Nothing to add"}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="extend-series-count" className={labelClass}>
            Meetings after this one
          </label>
          <input
            id="extend-series-count"
            type="number"
            inputMode="numeric"
            value={count}
            min={1}
            max={RECURRENCE_MAX_OCCURRENCES}
            step={1}
            onChange={(event) => {
              const typed = Number(event.target.value)
              if (Number.isFinite(typed) && typed >= 1) setCount(Math.min(Math.floor(typed), RECURRENCE_MAX_OCCURRENCES))
            }}
            disabled={isSaving}
            className={fieldClass}
          />
        </div>

        <p className="text-[12px] leading-relaxed text-on-surface-variant" aria-live="polite">
          <span className="font-semibold text-on-surface">
            {following} {following === 1 ? "meeting" : "meetings"}
          </span>{" "}
          already come after this one.
          {missing === 0
            ? " The series already runs that far, so nothing would be added."
            : addedDates.length > 0 && (
                <>
                  {" "}
                  Adding{" "}
                  <span className="font-semibold text-on-surface">
                    {missing} {missing === 1 ? "more" : "more"}
                  </span>
                  :{" "}
                  {addedDates.length <= 6
                    ? addedDates.map(shortDay).join(", ")
                    : `${shortDay(addedDates[0])} to ${shortDay(addedDates[addedDates.length - 1])}`}
                  .
                </>
              )}
        </p>

        <p className="rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2.5 text-[12px] leading-relaxed text-on-surface-variant">
          Each new meeting copies this one&apos;s name, time and person, with preparation off. A series holds at most{" "}
          {RECURRENCE_MAX_OCCURRENCES} meetings. {MEETING_PLANNER_MESSAGES.seriesExtendHint}
        </p>
      </div>
    </Modal>
  )
}
