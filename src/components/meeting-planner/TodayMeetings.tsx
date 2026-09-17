"use client"

import React from "react"
import Link from "next/link"
import { CalendarCheck, ChevronRight, Sun } from "lucide-react"
import { MEETING_PLANNER_MESSAGES } from "@/constants/meetingPlanner"
import { dayLabel, formatTime } from "@/lib/meetingDates"
import type { MeetingPlan } from "@/types/meetingPlanner"
import { MeetingStatusButton } from "./MeetingStatusButton"
import { PrepBadge } from "./PrepBadge"

interface TodayMeetingsProps {
  meetings: MeetingPlan[]
  todayDate: string
  pendingToday: number
  savingIds: ReadonlySet<string>
  onToggleStatus: (meeting: MeetingPlan) => void
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
  onToggleStatus,
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
      <ul className="grid gap-2 sm:grid-cols-2">
        {meetings.map((meeting) => (
          <li key={meeting.id}>
            <div
              className={`flex items-center gap-3 rounded-xl border p-3 ${
                meeting.status === "completed" ? "border-success/40 bg-success-container/40" : "border-outline-variant bg-surface-container-lowest"
              }`}
            >
              <span className="shrink-0 rounded-lg bg-primary-fixed px-2 py-1 text-[12px] font-bold tabular-nums text-on-primary-fixed-variant">
                {formatTime(meeting.meetingTime)}
              </span>
              <Link
                href={`/meeting-planner/${meeting.id}`}
                className="group min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <span className="flex min-w-0 items-center gap-1 text-[13px] font-semibold text-on-surface group-hover:text-primary">
                  <span className="truncate">{meeting.name}</span>
                  <ChevronRight size={13} className="shrink-0 text-outline" aria-hidden="true" />
                </span>
                {meeting.personName && <span className="block truncate text-[11px] text-outline">{meeting.personName}</span>}
                <PrepBadge meeting={meeting} className="mt-1" />
              </Link>
              <MeetingStatusButton
                meeting={meeting}
                isSaving={savingIds.has(meeting.id)}
                onToggle={onToggleStatus}
                size="compact"
              />
            </div>
          </li>
        ))}
      </ul>
    )}
  </section>
)
