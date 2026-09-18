"use client"

import React from "react"
import { fromTwelveHour, toTwelveHour, type DayPeriod } from "@/lib/meetingDates"

interface TimeFieldProps {
  // The saved 24-hour HH:mm; everything the user sees and picks is on the 12-hour clock
  value: string
  onChange: (time: string) => void
  disabled?: boolean
  labelClass: string
}

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1)
// Every minute of the hour, 00 to 59 with no gaps, so a meeting can be put at 9:07 as easily as 9:00
const MINUTES = Array.from({ length: 60 }, (_, index) => `${index}`.padStart(2, "0"))
const PERIODS: DayPeriod[] = ["AM", "PM"]

const selectClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-2 py-2.5 text-sm tabular-nums text-on-surface focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"

/**
 * A meeting time picked the way it is said: hour, minutes, then AM or PM ("8:30 PM", never "20:30"),
 * whatever clock format the computer itself is set to. It still hands back HH:mm, which is how
 * meetings are saved and sorted.
 */
export const TimeField: React.FC<TimeFieldProps> = ({ value, onChange, disabled = false, labelClass }) => {
  const { hour, minute, period } = toTwelveHour(value)

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className={labelClass}>Time</legend>
      <div className="flex items-center gap-2">
        <select
          aria-label="Hour"
          value={hour}
          onChange={(event) => onChange(fromTwelveHour(Number(event.target.value), minute, period))}
          className={selectClass}
        >
          {HOURS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="font-bold text-outline" aria-hidden="true">
          :
        </span>
        <select
          aria-label="Minutes"
          value={minute}
          onChange={(event) => onChange(fromTwelveHour(hour, event.target.value, period))}
          className={selectClass}
        >
          {MINUTES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <div role="group" aria-label="AM or PM" className="flex shrink-0 rounded-xl border border-outline-variant bg-surface-container-low p-0.5">
          {PERIODS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={period === option}
              onClick={() => onChange(fromTwelveHour(hour, minute, option))}
              className={`rounded-lg px-2.5 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                period === option ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </fieldset>
  )
}
