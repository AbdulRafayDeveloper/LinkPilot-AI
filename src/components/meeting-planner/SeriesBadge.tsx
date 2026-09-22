"use client"

import React from "react"
import { Repeat } from "lucide-react"
import { RECURRENCE_PATTERNS } from "@/constants/meetingPlanner"
import { dayLabel } from "@/lib/meetingDates"
import type { MeetingPlan } from "@/types/meetingPlanner"

type SeriesFields = Pick<MeetingPlan, "seriesId" | "recurrencePattern" | "recurrenceUntil">

/** "Every week until Mon 20 Oct", or null for a meeting in no series. */
export function describeSeries(meeting: SeriesFields): string | null {
  if (!meeting.seriesId) return null
  const pattern = RECURRENCE_PATTERNS.find((entry) => entry.id === meeting.recurrencePattern)
  const until = meeting.recurrenceUntil ? ` until ${dayLabel(meeting.recurrenceUntil, { weekday: "short", month: "short" })}` : ""
  return `${pattern?.label ?? "Repeats"}${until}`
}

/**
 * A small tag on a meeting that belongs to a repeating series, wherever it is listed. It says how
 * the series repeats, in words as well as the icon, and nothing for a one-off meeting.
 */
export const SeriesBadge: React.FC<{ meeting: SeriesFields; className?: string }> = ({ meeting, className = "" }) => {
  const description = describeSeries(meeting)
  if (!description) return null
  const pattern = RECURRENCE_PATTERNS.find((entry) => entry.id === meeting.recurrencePattern)
  return (
    <span
      title={`Repeating meeting: ${description}`}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-secondary-fixed px-2 py-0.5 text-[10.5px] font-bold text-on-secondary-fixed-variant ${className}`}
    >
      <Repeat size={11} aria-hidden="true" />
      {pattern?.label ?? "Repeats"}
      <span className="sr-only">. Repeating meeting: {description}</span>
    </span>
  )
}
