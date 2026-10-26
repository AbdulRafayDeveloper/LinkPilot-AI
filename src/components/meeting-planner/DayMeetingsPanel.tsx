"use client"

import React from "react"
import Link from "next/link"
import { CalendarPlus, ChevronRight, Clock, FileText, NotebookPen, Pencil, Trash2 } from "lucide-react"
import { MEETING_PLANNER_MESSAGES, type MeetingPlanStatusId } from "@/constants/meetingPlanner"
import { MEETING_PLAN_LINK_MESSAGES } from "@/constants/meetings"
import { dayLabel, formatTime } from "@/lib/meetingDates"
import type { MeetingPlan } from "@/types/meetingPlanner"
import { JoinLink } from "./JoinLink"
import { MeetingStatusButton } from "./MeetingStatusButton"
import { PrepBadge } from "./PrepBadge"
import { SeriesBadge } from "./SeriesBadge"
import { RecordedBadge } from "./RecordedBadge"
import { QuickRecordButton } from "@/components/meetings/QuickRecordButton"

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

const iconButton =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-outline transition-colors disabled:cursor-not-allowed disabled:opacity-50"

/**
 * Every meeting on the selected day, in time order. However many there are, they are all here
 * with their name, exact time and status, so a full calendar cell never hides one. Each can be
 * moved (the pencil) or deleted (the bin) here; for a meeting in a repeating series both act on
 * that one occurrence, and deleting also offers the whole series.
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
              <div className="flex flex-wrap items-center justify-end gap-0.5">
                {/* Recorded, in words, at the start of the line: a button can't sit inside the row's link above */}
                <span className="mr-auto">
                  <RecordedBadge meeting={meeting} onOpen={() => onLinked(meeting)} />
                </span>
                {/* The attend link first, so any day's meeting is joined and copied from here */}
                <JoinLink url={meeting.joinUrl} name={meeting.name} />
                {/* Record it from here: the recording is linked to this meeting from the start */}
                <QuickRecordButton plan={{ id: meeting.id, name: meeting.name }} variant="icon" />
                {/* What it was written up as, when there is something: the records of this meeting */}
                {(meeting.linkedCount ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => onLinked(meeting)}
                    aria-label={`Open the notes and recordings of ${meeting.name}`}
                    title={MEETING_PLAN_LINK_MESSAGES.notesOn(meeting.linkedCount ?? 0)}
                    className={`${iconButton} relative text-primary hover:bg-primary/5`}
                  >
                    <FileText size={14} aria-hidden="true" />
                    <span className="absolute -right-0.5 -top-0.5 rounded-full bg-primary px-1 text-[9px] font-bold leading-[14px] text-white">
                      {meeting.linkedCount}
                    </span>
                  </button>
                )}
                <MeetingStatusButton meeting={meeting} isSaving={savingIds.has(meeting.id)} onChange={onChangeStatus} />
                <button
                  type="button"
                  onClick={() => onNotes(meeting)}
                  aria-label={`${meeting.hasNotes ? "Read or write" : "Write"} notes for ${meeting.name}`}
                  title={meeting.hasNotes ? "Notes on this meeting" : "Write notes for this meeting"}
                  className={`${iconButton} relative hover:bg-primary/5 hover:text-primary ${
                    meeting.hasNotes ? "text-primary" : ""
                  }`}
                >
                  <NotebookPen size={14} aria-hidden="true" />
                  {/* A dot rather than a count: a list says there is something to read, not how much */}
                  {meeting.hasNotes && (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                  )}
                </button>
                {/* Everything about the meeting, the attend link included, without opening it first:
                    the owner asked to be able to add that link while editing from here */}
                <button
                  type="button"
                  onClick={() => onEditDetails(meeting)}
                  disabled={savingIds.has(meeting.id)}
                  aria-label={`Edit ${meeting.name}`}
                  title="Edit this meeting: its name, the person, the attend link"
                  className={`${iconButton} hover:bg-primary/5 hover:text-primary`}
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
                {/* The day and the time have their own button, as the meeting's own page does,
                    because for a repeating meeting they move the series rather than one week */}
                <button
                  type="button"
                  onClick={() => onEdit(meeting)}
                  disabled={savingIds.has(meeting.id)}
                  aria-label={`Change the day or time of ${meeting.name}`}
                  title={meeting.seriesId ? "Change the day or time of this meeting only" : "Change the day or time"}
                  className={`${iconButton} hover:bg-primary/5 hover:text-primary`}
                >
                  <Clock size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(meeting)}
                  disabled={savingIds.has(meeting.id)}
                  aria-label={`Delete ${meeting.name}`}
                  title={meeting.seriesId ? "Delete this meeting or its whole series" : "Delete this meeting"}
                  className={`${iconButton} hover:bg-error/5 hover:text-error`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
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
