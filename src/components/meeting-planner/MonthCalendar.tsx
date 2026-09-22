"use client"

import React, { useMemo } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Repeat, Sparkles } from "lucide-react"
import { DAY_CELL_MAX_MEETINGS } from "@/constants/meetingPlanner"
import { WEEKDAY_LABELS, calendarDays, dayOfMonth, formatTime, monthLabel, monthOf } from "@/lib/meetingDates"
import type { MeetingPlan } from "@/types/meetingPlanner"
import { prepStateOf } from "./PrepBadge"

interface MonthCalendarProps {
  month: string
  meetings: MeetingPlan[]
  today: string
  selectedDate: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  onMonthChange: (move: "previous" | "next" | "today") => void
  onSelectDay: (date: string) => void
}

/**
 * The month, with every meeting on its own day. A busy day shows its first few meetings by name
 * and time and says how many more there are; selecting the day lists all of them beside the
 * calendar, so nothing is ever hidden by a day being full.
 */
export const MonthCalendar: React.FC<MonthCalendarProps> = ({
  month,
  meetings,
  today,
  selectedDate,
  isLoading,
  canGoBack,
  canGoForward,
  onMonthChange,
  onSelectDay,
}) => {
  const days = useMemo(() => calendarDays(month), [month])
  const byDay = useMemo(() => {
    const grouped = new Map<string, MeetingPlan[]>()
    for (const meeting of meetings) {
      const day = grouped.get(meeting.meetingDate)
      if (day) day.push(meeting)
      else grouped.set(meeting.meetingDate, [meeting])
    }
    return grouped
  }, [meetings])

  return (
    <section
      aria-label="Meeting calendar"
      className="flex min-h-0 flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-on-surface">
          <CalendarDays size={16} className="text-primary" aria-hidden="true" />
          {monthLabel(month)}
          {isLoading && <Loader2 size={14} className="animate-spin text-outline" aria-label="Loading" />}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMonthChange("previous")}
            disabled={!canGoBack}
            aria-label="Previous month"
            className="rounded-lg border border-outline-variant bg-white p-1.5 text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onMonthChange("today")}
            className="rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onMonthChange("next")}
            disabled={!canGoForward}
            aria-label="Next month"
            className="rounded-lg border border-outline-variant bg-white p-1.5 text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="-mt-1 flex items-center gap-1.5 text-[11px] text-on-surface-variant">
        <span className="inline-flex items-center gap-0.5 rounded bg-primary-fixed px-1 py-0.5 text-[10px] text-on-primary-fixed-variant ring-1 ring-primary/50" aria-hidden="true">
          <Sparkles size={9} className="text-primary" />
          10:00
        </span>
        A spark on a meeting means its preparation is written;
        <Repeat size={11} className="text-on-secondary-fixed-variant" aria-hidden="true" />
        means it repeats.
      </p>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-outline">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((date) => {
          const dayMeetings = byDay.get(date) ?? []
          const isOtherMonth = monthOf(date) !== month
          const isToday = date === today
          const isSelected = date === selectedDate
          const shown = dayMeetings.slice(0, DAY_CELL_MAX_MEETINGS)
          const hidden = dayMeetings.length - shown.length
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDay(date)}
              aria-pressed={isSelected}
              aria-label={`${date}, ${dayMeetings.length} ${dayMeetings.length === 1 ? "meeting" : "meetings"}`}
              className={`flex min-h-[86px] flex-col gap-1 rounded-xl border p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                isSelected ? "border-primary bg-primary/5" : "border-outline-variant hover:bg-surface-container-low"
              } ${isOtherMonth ? "opacity-45" : ""}`}
            >
              <span
                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
                  isToday ? "bg-primary text-white" : "text-on-surface-variant"
                }`}
              >
                {dayOfMonth(date)}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                {shown.map((meeting) => {
                  const hasPrep = prepStateOf(meeting) === "ready"
                  return (
                    <span
                      key={meeting.id}
                      title={`${formatTime(meeting.meetingTime)} ${meeting.name}${hasPrep ? " · preparation ready" : ""}${meeting.seriesId ? " · repeats" : ""}`}
                      className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight ${
                        meeting.status === "completed"
                          ? "bg-success-container text-on-success-container"
                          : "bg-primary-fixed text-on-primary-fixed-variant"
                      } ${hasPrep ? "ring-1 ring-primary/50" : ""}`}
                    >
                      {hasPrep && (
                        <>
                          <Sparkles size={9} className="mr-0.5 inline-block align-[-1px] text-primary" aria-hidden="true" />
                          <span className="sr-only">Preparation ready: </span>
                        </>
                      )}
                      {meeting.seriesId && (
                        <>
                          <Repeat size={9} className="mr-0.5 inline-block align-[-1px] text-on-secondary-fixed-variant" aria-hidden="true" />
                          <span className="sr-only">Repeats: </span>
                        </>
                      )}
                      <span className="font-bold tabular-nums">{formatTime(meeting.meetingTime)}</span> {meeting.name}
                    </span>
                  )
                })}
                {hidden > 0 && <span className="px-1 text-[10px] font-bold text-primary">+{hidden} more</span>}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
