import { shiftDate } from "@/lib/taskDates"
import { RECURRENCE_MAX_DAYS, RECURRENCE_PATTERNS, type RecurrencePatternId } from "@/constants/meetingPlanner"

/**
 * The days a repeating meeting falls on. Days are plain YYYY-MM-DD strings, like every other day in
 * the planner, so a series never drifts a day on a server in another timezone. Kept free of the
 * database and of React, so the page and the server work the series out the same way and the rules
 * can be tested on their own.
 */

// Sunday is 0 and Saturday 6, read in UTC so a plain date never shifts
const weekday = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay()
const isWeekday = (date: string): boolean => weekday(date) !== 0 && weekday(date) !== 6

/** The last day a series starting on `start` may run to. */
export const latestUntil = (start: string): string => shiftDate(start, RECURRENCE_MAX_DAYS)

/** Where a new series ends unless the user picks otherwise: a week of days, or a month of weeks. */
export function defaultUntil(start: string, pattern: RecurrencePatternId): string {
  const days = RECURRENCE_PATTERNS.find((entry) => entry.id === pattern)?.defaultDays ?? 6
  return shiftDate(start, Math.min(days, RECURRENCE_MAX_DAYS))
}

/**
 * Every day the series meets on, from `start` to `until` inclusive, in order. The first meeting is
 * always the day the user picked, even a Saturday for "every weekday": that is the day they asked
 * for. An `until` past the window is cut to it, and one before `start` leaves only `start`.
 */
export function recurrenceDates(start: string, pattern: RecurrencePatternId, until: string): string[] {
  const last = until > latestUntil(start) ? latestUntil(start) : until
  const dates = [start]
  const step = pattern === "weekly" ? 7 : 1
  for (let day = shiftDate(start, step); day <= last; day = shiftDate(day, step)) {
    if (pattern === "weekdays" && !isWeekday(day)) continue
    dates.push(day)
  }
  return dates
}
