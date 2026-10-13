"use client"

import React from "react"
import Link from "next/link"
import { CalendarCheck, ChevronRight, NotebookPen, Pencil, Sun } from "lucide-react"
import { MEETING_PLANNER_MESSAGES, type MeetingPlanStatusId } from "@/constants/meetingPlanner"
import { dayLabel, formatTime } from "@/lib/meetingDates"
import type { MeetingPlan } from "@/types/meetingPlanner"
import { JoinLink } from "./JoinLink"
import { MeetingStatusButton } from "./MeetingStatusButton"
import { PrepBadge } from "./PrepBadge"
import { SeriesBadge } from "./SeriesBadge"

interface TodayMeetingsProps {
  meetings: MeetingPlan[]
  todayDate: string
  pendingToday: number
  savingIds: ReadonlySet<string>
  onChangeStatus: (meeting: MeetingPlan, status: MeetingPlanStatusId) => void
  // Opening the meeting's notes, written before it or after it
  onNotes: (meeting: MeetingPlan) => void
  // Editing it where it is read, so today's attend link can be added at the last minute
  onEditDetails: (meeting: MeetingPlan) => void
}

/**
 * Today, at the top of the page: how many meetings there are, what they are, when each one is
 * and where it stands. It is the first thing on screen whatever month the calendar is showing.
 */
export const TodayMeetings: React.FC<TodayMeetingsProps> = ({
  meetings,
  todayDate,
  pendingToday,
  savingIds,
  onChangeStatus,
  onNotes,
  onEditDetails,
}) => (
  <section
    aria-label="Today's meetings"
    className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm"
  >
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-bold text-on-surface">
        <Sun size={16} className="text-primary" aria-hidden="true" />
        Today
        {todayDate && <span className="text-[11px] font-medium text-outline">{dayLabel(todayDate)}</span>}
      </h2>
      <span className="text-[11px] font-semibold text-outline">
        {meetings.length === 0
          ? "0 meetings"
          : `${meetings.length} ${meetings.length === 1 ? "meeting" : "meetings"}${
              pendingToday > 0 ? ` · ${pendingToday} still to come` : " · all done"
            }`}
      </span>
    </div>

    {meetings.length === 0 ? (
      <p className="flex items-center gap-2 rounded-xl bg-surface-container-low px-3 py-3 text-[13px] text-on-surface-variant">
        <CalendarCheck size={15} className="shrink-0 text-outline" aria-hidden="true" />
        {MEETING_PLANNER_MESSAGES.emptyToday}
      </p>
    ) : (
      /* One meeting a row: this card sits in the page's narrow right column, where two columns left
         the name about 70px and truncated it to nothing */
      <ul className="flex flex-col gap-2">
        {meetings.map((meeting) => (
          <li key={meeting.id}>
            <div
              /* Today's meetings are the brand's violet, at the owner's request: they sat in the
                 same plain grey as the day panel below them and the two cards read as one list */
              className={`flex flex-col gap-1.5 rounded-xl border p-3 ${
                meeting.status === "completed"
                  ? "border-success/40 bg-success-container/40"
                  : meeting.status === "cancelled"
                    ? "border-error/30 bg-error-container/30"
                    : "border-primary/30 bg-primary/5"
              }`}
            >
              {/* The time, the tags and what can be done, all of which keep their own width: the
                  name below then has the whole row, rather than the ~70px it was truncated to */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="shrink-0 rounded-lg bg-primary-fixed px-2 py-1 text-[12px] font-bold tabular-nums text-on-primary-fixed-variant">
                  {formatTime(meeting.meetingTime)}
                </span>
                <PrepBadge meeting={meeting} />
                <SeriesBadge meeting={meeting} />
                <span className="ml-auto flex items-center gap-1">
                  {/* The attend link where the meeting is read, so the call is one click at the hour */}
                  <JoinLink url={meeting.joinUrl} name={meeting.name} />
                  <button
                    type="button"
                    onClick={() => onNotes(meeting)}
                    aria-label={`${meeting.hasNotes ? "Read or write" : "Write"} notes for ${meeting.name}`}
                    title={meeting.hasNotes ? "Notes on this meeting" : "Write notes for this meeting"}
                    className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-primary/5 hover:text-primary ${
                      meeting.hasNotes ? "text-primary" : "text-outline"
                    }`}
                  >
                    <NotebookPen size={14} aria-hidden="true" />
                    {meeting.hasNotes && (
                      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditDetails(meeting)}
                    aria-label={`Edit ${meeting.name}`}
                    title="Edit this meeting: its name, the person, the attend link"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-outline transition-colors hover:bg-primary/5 hover:text-primary"
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                  <MeetingStatusButton meeting={meeting} isSaving={savingIds.has(meeting.id)} onChange={onChangeStatus} />
                </span>
              </div>

              <Link
                href={`/meeting-planner/${meeting.id}`}
                className="group block min-w-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <span className="flex min-w-0 items-center gap-1 text-[13px] font-semibold text-on-surface group-hover:text-primary">
                  {/* A cancelled meeting is struck through as well as chipped, so it never rests on colour */}
                  <span className={`truncate ${meeting.status === "cancelled" ? "line-through decoration-error/60" : ""}`}>
                    {meeting.name}
                  </span>
                  <ChevronRight size={13} className="shrink-0 text-outline" aria-hidden="true" />
                </span>
                {meeting.personName && <span className="block truncate text-[11px] text-outline">{meeting.personName}</span>}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    )}
  </section>
)
