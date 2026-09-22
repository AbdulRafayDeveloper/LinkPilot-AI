"use client"

import React from "react"
import Link from "next/link"
import { CalendarPlus, ChevronRight, Pencil, Trash2 } from "lucide-react"
import { MEETING_PLANNER_MESSAGES } from "@/constants/meetingPlanner"
import { dayLabel, formatTime } from "@/lib/meetingDates"
import type { MeetingPlan } from "@/types/meetingPlanner"
import { MeetingStatusButton } from "./MeetingStatusButton"
import { PrepBadge } from "./PrepBadge"
import { SeriesBadge } from "./SeriesBadge"

interface DayMeetingsPanelProps {
  date: string
  meetings: MeetingPlan[]
  savingIds: ReadonlySet<string>
  onToggleStatus: (meeting: MeetingPlan) => void
  onAddMeeting: (date: string) => void
  // Moving this one meeting to another day or time, and deleting it (or its whole series)
  onEdit: (meeting: MeetingPlan) => void
  onDelete: (meeting: MeetingPlan) => void
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
  onToggleStatus,
  onAddMeeting,
  onEdit,
  onDelete,
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
                : "border-outline-variant bg-surface-container-lowest"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <Link
                href={`/meeting-planner/${meeting.id}`}
                className="group min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-bold tabular-nums text-primary">{formatTime(meeting.meetingTime)}</span>
                  <PrepBadge meeting={meeting} />
                  <SeriesBadge meeting={meeting} />
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-on-surface group-hover:text-primary">
                  <span className="truncate">{meeting.name}</span>
                  <ChevronRight size={13} className="shrink-0 text-outline" aria-hidden="true" />
                </span>
                {meeting.personName && <span className="block truncate text-[11px] text-outline">{meeting.personName}</span>}
              </Link>
              <div className="flex shrink-0 items-center gap-0.5">
                <MeetingStatusButton meeting={meeting} isSaving={savingIds.has(meeting.id)} onToggle={onToggleStatus} />
                <button
                  type="button"
                  onClick={() => onEdit(meeting)}
                  disabled={savingIds.has(meeting.id)}
                  aria-label={`Change the day or time of ${meeting.name}`}
                  title={meeting.seriesId ? "Change the day or time of this meeting only" : "Change the day or time"}
                  className={`${iconButton} hover:bg-primary/5 hover:text-primary`}
                >
                  <Pencil size={14} aria-hidden="true" />
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
