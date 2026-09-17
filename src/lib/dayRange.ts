/**
 * The date filters hold days as the date input gives them (YYYY-MM-DD). A request sends the start
 * and end of those days where the viewer is, so "today" means the viewer's today, not the server's.
 */
const startOfDay = (day: string) => new Date(`${day}T00:00:00`).toISOString()
const endOfDay = (day: string) => new Date(`${day}T23:59:59.999`).toISOString()

export function appendDayRange(params: URLSearchParams, fromDay: string, toDay: string): URLSearchParams {
  if (fromDay) params.set("from", startOfDay(fromDay))
  if (toDay) params.set("to", endOfDay(toDay))
  return params
}

// Plain YYYY-MM-DD strings compare correctly as text
export const isBackwardsRange = (fromDay: string, toDay: string) => Boolean(fromDay && toDay && fromDay > toDay)
