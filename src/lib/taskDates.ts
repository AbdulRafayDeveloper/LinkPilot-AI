/**
 * Calendar-day helpers for Daily Tasks. A day is a plain YYYY-MM-DD string, so these never
 * depend on the server's timezone: the browser says which day it is on, and everything after
 * that is string and calendar maths.
 */
const DAY_MS = 86_400_000
const WEEKDAY_AND_DATE: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "short" }

/**
 * The calendar day `days` before (negative) or after an ISO date.
 */
export function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day) + days * DAY_MS).toISOString().slice(0, 10)
}

/**
 * The day the given clock is on, in its own timezone (never UTC, which would turn the day over
 * in the middle of the user's).
 */
export function todayIso(now: Date = new Date()): string {
  const month = `${now.getMonth() + 1}`.padStart(2, "0")
  const day = `${now.getDate()}`.padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * How a day's heading reads: the nearest days by name, the rest by weekday and date.
 */
export function dayLabel(date: string, today: string): { title: string; detail: string } {
  const detail = new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { ...WEEKDAY_AND_DATE, timeZone: "UTC" })
  if (date === today) return { title: "Today", detail }
  if (date === shiftDate(today, -1)) return { title: "Yesterday", detail }
  return { title: detail, detail: "" }
}
