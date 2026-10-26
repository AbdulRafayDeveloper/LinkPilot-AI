import { displayTimeZone, startOfDayIn } from "@/lib/timeZone"
import { shiftDate } from "@/lib/taskDates"

/**
 * The date filters hold days as the date input gives them (YYYY-MM-DD). A request sends the start
 * and end of those days in the viewer's chosen timezone, so "today" means the viewer's today, not
 * the server's or the browser's.
 */
const startOfDay = (day: string) => startOfDayIn(day, displayTimeZone()).toISOString()
const endOfDay = (day: string) => new Date(startOfDayIn(shiftDate(day, 1), displayTimeZone()).getTime() - 1).toISOString()

export function appendDayRange(params: URLSearchParams, fromDay: string, toDay: string): URLSearchParams {
  if (fromDay) params.set("from", startOfDay(fromDay))
  if (toDay) params.set("to", endOfDay(toDay))
  return params
}

// Plain YYYY-MM-DD strings compare correctly as text
export const isBackwardsRange = (fromDay: string, toDay: string) => Boolean(fromDay && toDay && fromDay > toDay)
