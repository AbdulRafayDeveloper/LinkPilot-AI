import { shiftDate } from "@/lib/taskDates"
import {
  RECURRENCE_MAX_DAYS,
  RECURRENCE_MAX_OCCURRENCES,
  RECURRENCE_PATTERNS,
  type RecurrencePatternId,
} from "@/constants/meetingPlanner"

/**
 * The days a repeating meeting falls on. Days are plain YYYY-MM-DD strings, like every other day in
 * the planner, so a series never drifts a day on a server in another timezone. Kept free of the
 * database and of React, so the page and the server work the series out the same way and the rules
 * can be tested on their own.
 *
 * A series is **counted in meetings**, not bounded by a date: the owner asked to say how many weeks
 * a weekly meeting runs for, and later to add more from any week of it, so `datesForCount` is what
 * the form and the server both build a series from. `recurrenceDates` is still here for a caller
 * that names an end date, and the two agree: `datesForCount` is `recurrenceDates` stopped early.
 */

// Sunday is 0 and Saturday 6, read in UTC so a plain date never shifts
const weekday = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay()
const isWeekday = (date: string): boolean => weekday(date) !== 0 && weekday(date) !== 6

/** The last day a series starting on `start` may run to. */
export const latestUntil = (start: string): string => shiftDate(start, RECURRENCE_MAX_DAYS)

/** How many meetings a new series holds unless the user picks otherwise. */
export function defaultCount(pattern: RecurrencePatternId): number {
  const count = RECURRENCE_PATTERNS.find((entry) => entry.id === pattern)?.defaultCount ?? 4
  return Math.min(Math.max(count, 2), RECURRENCE_MAX_OCCURRENCES)
}

/** Where a new series ends unless the user picks otherwise, as a day. */
export function defaultUntil(start: string, pattern: RecurrencePatternId): string {
  const dates = datesForCount(start, pattern, defaultCount(pattern))
  return dates[dates.length - 1] ?? start
}

/**
 * The day after `from` that this pattern next meets on. Daily steps a day, weekly a week, and
 * "every weekday" steps a day at a time past a weekend.
 */
export function nextDate(from: string, pattern: RecurrencePatternId): string {
  if (pattern === "weekly") return shiftDate(from, 7)
  let day = shiftDate(from, 1)
  while (pattern === "weekdays" && !isWeekday(day)) day = shiftDate(day, 1)
  return day
}

/**
 * The `count` days a series starting on `start` meets on, in order. The first meeting is always the
 * day the user picked, even a Saturday for "every weekday": that is the day they asked for. A count
 * under 1 gives just that day, and one over the ceiling is cut to it, as is a series that would run
 * past `RECURRENCE_MAX_DAYS`, so no series is ever open-ended.
 */
export function datesForCount(start: string, pattern: RecurrencePatternId, count: number): string[] {
  const wanted = Math.min(Math.max(Math.floor(count) || 1, 1), RECURRENCE_MAX_OCCURRENCES)
  const last = latestUntil(start)
  const dates = [start]
  let day = nextDate(start, pattern)
  while (dates.length < wanted && day <= last) {
    dates.push(day)
    day = nextDate(day, pattern)
  }
  return dates
}

/**
 * The next `count` days a series meets on **after** `from`, which is how a series is extended from
 * any one of its meetings. The window is measured from `from`, so extending again later is always
 * allowed; what caps the series as a whole is `RECURRENCE_MAX_OCCURRENCES`, checked where it is
 * extended, since only the database knows how many meetings it already holds.
 */
export function datesAfter(from: string, pattern: RecurrencePatternId, count: number): string[] {
  const wanted = Math.min(Math.max(Math.floor(count) || 1, 1), RECURRENCE_MAX_OCCURRENCES)
  const dates: string[] = []
  let day = nextDate(from, pattern)
  for (let index = 0; index < wanted; index += 1) {
    dates.push(day)
    day = nextDate(day, pattern)
  }
  return dates
}

/**
 * Every day the series meets on, from `start` to `until` inclusive, in order. An `until` past the
 * window is cut to it, and one before `start` leaves only `start`.
 */
export function recurrenceDates(start: string, pattern: RecurrencePatternId, until: string): string[] {
  const last = until > latestUntil(start) ? latestUntil(start) : until
  const dates = [start]
  let day = nextDate(start, pattern)
  while (day <= last && dates.length < RECURRENCE_MAX_OCCURRENCES) {
    dates.push(day)
    day = nextDate(day, pattern)
  }
  return dates
}
