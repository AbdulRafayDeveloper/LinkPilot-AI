"use client"

import React from "react"
import Link from "next/link"
import { CalendarPlus, ChevronRight } from "lucide-react"
import { MEETING_PLANNER_MESSAGES, type MeetingPlanStatusId } from "@/constants/meetingPlanner"
import { dayLabel, formatTime } from "@/lib/meetingDates"
import type { MeetingPlan } from "@/types/meetingPlanner"
import { JoinLink } from "./JoinLink"
import { MeetingStatusButton } from "./MeetingStatusButton"
import { PrepBadge } from "./PrepBadge"
import { SeriesBadge } from "./SeriesBadge"
import { RecordedBadge } from "./RecordedBadge"
import { MeetingRowMenu } from "./MeetingRowMenu"

interface DayMeetingsPanelProps {
  date: string
  meetings: MeetingPlan[]
  savingIds: ReadonlySet<string>
  onChangeStatus: (meeting: MeetingPlan, status: MeetingPlanStatusId) => void
  onAddMeeting: (date: string) => void
  // Moving this one meeting to another day or time, and deleting it (or its whole series)
  onEdit: (meeting: MeetingPlan) => void
  // Editing everything else about it, including the attend link, without leaving the calendar
  onEditDetails: (meeting: MeetingPlan) => void
  onDelete: (meeting: MeetingPlan) => void
  // Opening the meeting's notes, written before it or after it
  onNotes: (meeting: MeetingPlan) => void
  /**
   * Opening what this meeting was written up as: the notes and recordings linked to it from Meeting
   * Notes to Tasks. Only shown on a meeting that has some, so a row stays about the meeting itself.
   */
  onLinked: (meeting: MeetingPlan) => void
}

/**
 * Every meeting on the selected day, in time order. However many there are, they are all here
 * with their name, exact time and status, so a full calendar cell never hides one. Each can be
 * moved or deleted from its three-dot menu; for a meeting in a repeating series both act on that
 * one occurrence, and deleting also offers the whole series.
 */
export const DayMeetingsPanel: React.FC<DayMeetingsPanelProps> = ({
  date,
  meetings,
  savingIds,
  onChangeStatus,
  onAddMeeting,
  onEdit,
  onEditDetails,
  onDelete,
  onNotes,
  onLinked,
}) => (
  <section
    aria-label={`Meetings on ${date}`}
    className="flex min-h-0 flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm"
  >
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-sm font-bold text-on-surface">{date ? dayLabel(date) : "Select a day"}</h2>
      <span className="text-[11px] text-outline">
        {meetings.length} {meetings.length === 1 ? "meeting" : "meetings"}
      </span>
    </div>

    {meetings.length === 0 ? (
      <p className="rounded-xl bg-surface-container-low px-3 py-3 text-[13px] text-on-surface-variant">
        {MEETING_PLANNER_MESSAGES.emptyDay}
      </p>
    ) : (
      <ul className="custom-scrollbar flex-1 space-y-2 overflow-y-auto pr-1">
        {meetings.map((meeting) => (
          <li
            key={meeting.id}
            className={`rounded-xl border p-3 ${
              meeting.status === "completed"
                ? "border-success/40 bg-success-container/40"
                : meeting.status === "cancelled"
                  ? "border-error/30 bg-error-container/30"
                  : "border-outline-variant bg-surface-container-lowest"
            }`}
          >
            {/* The name on its own line above the controls: this panel sits in the page's narrow
                right column, where a status chip and three buttons beside the name left it about
                150px and cut it off mid-word */}
            <div className="flex flex-col gap-1.5">
              <Link
                href={`/meeting-planner/${meeting.id}`}
                className="group block min-w-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-bold tabular-nums text-primary">{formatTime(meeting.meetingTime)}</span>
                  <PrepBadge meeting={meeting} />
                  <SeriesBadge meeting={meeting} />
                </span>
                <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[13px] font-semibold text-on-surface group-hover:text-primary">
                  {/* A cancelled meeting is struck through, so the list says so without its chip being read */}
                  <span className={`truncate ${meeting.status === "cancelled" ? "line-through decoration-error/60" : ""}`}>
                    {meeting.name}
                  </span>
                  <ChevronRight size={13} className="shrink-0 text-outline" aria-hidden="true" />
                </span>
                {meeting.personName && <span className="block truncate text-[11px] text-outline">{meeting.personName}</span>}
              </Link>
              <div className="flex flex-wrap items-center justify-end gap-1">
                {/* Recorded, in words, at the start of the line: a button can't sit inside the row's link above */}
                <span className="mr-auto">
                  <RecordedBadge meeting={meeting} onOpen={() => onLinked(meeting)} />
                </span>
                {/* Join and the status stay on the row; everything else is behind the three dots,
                    as a daily task's row has it, each line with its word and its icon */}
                <JoinLink url={meeting.joinUrl} name={meeting.name} showCopy={false} />
                <MeetingStatusButton meeting={meeting} isSaving={savingIds.has(meeting.id)} onChange={onChangeStatus} />
                <MeetingRowMenu
                  meeting={meeting}
                  isSaving={savingIds.has(meeting.id)}
                  onNotes={onNotes}
                  onEditDetails={onEditDetails}
                  onLinked={onLinked}
                  onMove={onEdit}
                  onDelete={onDelete}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    )}

    <button
      type="button"
      onClick={() => onAddMeeting(date)}
      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
    >
      <CalendarPlus size={16} aria-hidden="true" />
      Add a meeting on this day
    </button>
  </section>
)
