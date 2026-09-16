import { todayIso } from "@/lib/taskDates"

/**
 * Calendar helpers for the meeting planner. A day is a plain YYYY-MM-DD string and a time a
 * plain HH:mm, both from the browser's own clock, so nothing here depends on the server's
 * timezone. `todayIso` is shared with Daily Tasks rather than written twice.
 */
export { todayIso }

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/
// The calendar starts its weeks on Monday
const WEEK_START = 1
export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const parseMonth = (month: string): { year: number; month: number } => {
  const match = month.match(MONTH_PATTERN)
  if (!match) throw new Error(`Not a month: ${month}`)
  return { year: Number(match[1]), month: Number(match[2]) }
}

const iso = (date: Date): string => date.toISOString().slice(0, 10)

/** The month a day belongs to (YYYY-MM). */
export const monthOf = (date: string): string => date.slice(0, 7)

/** The first and last day of a month. */
export const monthStart = (month: string): string => `${month}-01`
export function monthEnd(month: string): string {
  const { year, month: number } = parseMonth(month)
  return iso(new Date(Date.UTC(year, number, 0)))
}

/** The month `delta` months away, so the calendar can step back and forward. */
export function shiftMonth(month: string, delta: number): string {
  const { year, month: number } = parseMonth(month)
  const shifted = new Date(Date.UTC(year, number - 1 + delta, 1))
  return `${shifted.getUTCFullYear()}-${`${shifted.getUTCMonth() + 1}`.padStart(2, "0")}`
}

/** Whole months from one month to another, negative when the second is earlier. */
export function monthsBetween(from: string, to: string): number {
  const start = parseMonth(from)
  const end = parseMonth(to)
  return (end.year - start.year) * 12 + (end.month - start.month)
}

/**
 * Every day the month's grid shows, including the days from the months either side that fill the
 * first and last week, so the calendar is always whole weeks.
 */
export function calendarDays(month: string): string[] {
  const { year, month: number } = parseMonth(month)
  const first = Date.UTC(year, number - 1, 1)
  const last = Date.UTC(year, number, 0)
  const lead = (new Date(first).getUTCDay() - WEEK_START + 7) % 7
  const days: string[] = []
  for (let time = first - lead * 86_400_000; time <= last || days.length % 7 !== 0; time += 86_400_000) {
    days.push(iso(new Date(time)))
  }
  return days
}

/** "September 2026", for the calendar heading. */
export function monthLabel(month: string): string {
  return new Date(`${monthStart(month)}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** "Wednesday 16 September", for a day heading. */
export function dayLabel(date: string, options: Intl.DateTimeFormatOptions = {}): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    ...options,
  })
}

/** The day number a calendar cell shows. */
export const dayOfMonth = (date: string): number => Number(date.slice(8, 10))

/**
 * A wall-clock HH:mm as the reader's locale writes it ("2:30 PM" or "14:30"). The date part is
 * fixed and read back in UTC, so the hour shown is always the hour that was saved.
 */
export function formatTime(time: string): string {
  return new Date(`2000-01-01T${time}:00Z`).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  })
}

/** The next half hour on the user's own clock, as a sensible default for a new meeting. */
export function nextHalfHour(now: Date = new Date()): string {
  const next = new Date(now.getTime())
  next.setMinutes(now.getMinutes() > 30 ? 60 : 30, 0, 0)
  return `${`${next.getHours()}`.padStart(2, "0")}:${`${next.getMinutes()}`.padStart(2, "0")}`
}
