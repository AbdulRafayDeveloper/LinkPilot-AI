/**
 * The timezone every time in the app is shown in: the one the person chose in Account Settings
 * (`timeZone` on their account), or this browser's own until they choose one.
 *
 * A browser has no way to change the timezone `toLocaleString` uses, so **every time on screen goes
 * through `formatInstant`**, and every "which day is it" through `dayIn` / `startOfDayIn`, rather than
 * the browser's defaults. What is **not** converted is a plain calendar day or a wall-clock time the
 * user picked (a task's `2026-10-27`, a meeting's `15:00`): those are not moments, and shifting them
 * by an offset would move them to the wrong day. They keep their own `timeZone: "UTC"` formatting.
 *
 * The pure helpers work anywhere; the chosen zone itself lives in the browser, read from the account
 * when it loads (`hooks/useCurrentUser`) and remembered in this browser so the first paint of the
 * next page already uses it.
 */

const STORAGE_KEY = "linkpilot:timeZone"

/** This browser's own timezone, which is what is shown until the person chooses one. */
export const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"

/** Whether the runtime knows a timezone by this name (an IANA name such as "Asia/Karachi"). */
export function isTimeZone(zone: string): boolean {
  if (!zone || zone.length > 64) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/** Every timezone the runtime knows, UTC included, alphabetically. */
export function allTimeZones(): string[] {
  const listed = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []
  return [...new Set(["UTC", ...listed])].sort((a, b) => a.localeCompare(b))
}

// The wall clock in a zone at one instant, read in parts (a 24-hour clock, so midnight is 0)
function clockIn(zone: string, at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at)
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((entry) => entry.type === type)?.value ?? 0)
  return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour") % 24, minute: part("minute"), second: part("second") }
}

/** How far a zone is ahead of UTC at one instant, in minutes (daylight saving included). */
export function zoneOffsetMinutes(zone: string, at: Date = new Date()): number {
  const clock = clockIn(zone, at)
  const asUtc = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, clock.second)
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000)
}

/** "GMT+05:00", "GMT-04:00", "GMT+00:00". */
export function offsetLabel(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+"
  const whole = Math.abs(minutes)
  return `GMT${sign}${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`
}

/** One timezone as the picker offers it: its city, its region and how far it is from UTC now. */
export interface TimeZoneOption {
  zone: string
  // "New York", "Karachi", "UTC"
  city: string
  // "America", "Asia", or "" for UTC
  region: string
  offsetMinutes: number
  // "GMT-04:00"
  offset: string
  // Everything a search may match, lowercased: the zone, the city, the region and the offset written
  // the ways people type it ("gmt+5", "utc+05:00", "+5")
  search: string
}

// "GMT+05:30" -> "+5:30", "GMT+05:00" -> "+5", "GMT-04:00" -> "-4", the short form people type
function shortOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+"
  const whole = Math.abs(minutes)
  const rest = whole % 60
  return `${sign}${Math.floor(whole / 60)}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`
}

/** Every timezone the picker offers, from the furthest west to the furthest east, then by city. */
export function timeZoneOptions(at: Date = new Date()): TimeZoneOption[] {
  return allTimeZones()
    .map((zone) => {
      const segments = zone.split("/")
      const city = segments[segments.length - 1].replace(/_/g, " ")
      const region = segments.length > 1 ? segments[0] : ""
      const offsetMinutes = zoneOffsetMinutes(zone, at)
      const offset = offsetLabel(offsetMinutes)
      const short = shortOffset(offsetMinutes)
      const search = [zone, zone.replace(/[/_]/g, " "), city, region, offset, `utc${offset.slice(3)}`, `gmt${short}`, `utc${short}`, short]
        .join(" ")
        .toLowerCase()
      return { zone, city, region, offsetMinutes, offset, search }
    })
    .sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.zone.localeCompare(b.zone))
}

/** The calendar day a zone is on at one instant, as YYYY-MM-DD. */
export function dayIn(zone: string, at: Date = new Date()): string {
  const clock = clockIn(zone, at)
  return `${clock.year}-${String(clock.month).padStart(2, "0")}-${String(clock.day).padStart(2, "0")}`
}

/** The hour and minute a zone's clock shows at one instant. */
export function timeIn(zone: string, at: Date = new Date()): { hour: number; minute: number } {
  const { hour, minute } = clockIn(zone, at)
  return { hour, minute }
}

/**
 * The instant a calendar day starts in a zone (its midnight). The offset is read at a first guess
 * and once more at the answer, so a day that starts just after a daylight-saving change is still right.
 */
export function startOfDayIn(day: string, zone: string): Date {
  const [year, month, date] = day.split("-").map(Number)
  const guess = Date.UTC(year, month - 1, date)
  const first = guess - zoneOffsetMinutes(zone, new Date(guess)) * 60_000
  const second = guess - zoneOffsetMinutes(zone, new Date(first)) * 60_000
  return new Date(second)
}

// ---------- The zone this browser shows, for the signed-in person ----------

function readStored(): string | null {
  if (typeof window === "undefined") return null
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored && isTimeZone(stored) ? stored : null
  } catch {
    return null
  }
}

let chosen: string | null = readStored()
// Raised only when the account's zone turns out to differ from the one the page was drawn in
let redraws = 0
const listeners = new Set<() => void>()

/** The zone every time is shown in now: the person's choice, or this browser's own. */
export const displayTimeZone = (): string => chosen ?? browserTimeZone()

/** Whether the person has chosen a zone, rather than following this browser. */
export const hasChosenTimeZone = (): boolean => chosen !== null

/**
 * Sets the zone to show times in (null follows this browser), and keeps it in this browser so the
 * next page is drawn in it from the start.
 *
 * `redraw` is for the account's own zone arriving after the page was drawn (a first visit in this
 * browser, or a change made on another device): the page is drawn again so no time on it is left in
 * the old zone. A change made on Account Settings does not redraw, so that page keeps its own state.
 */
export function setDisplayTimeZone(zone: string | null, { redraw = false }: { redraw?: boolean } = {}): void {
  const next = zone && isTimeZone(zone) ? zone : null
  if (next === chosen) return
  const before = displayTimeZone()
  chosen = next
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, next)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // A browser that keeps nothing still shows the right zone on this page
  }
  if (redraw && displayTimeZone() !== before) redraws += 1
  listeners.forEach((listener) => listener())
}

/**
 * Listens for the zone changing. This module stays free of React, because server code reaches it
 * (`lib/taskDates.ts`, which the routes import); the hooks that re-render on a change are in
 * `hooks/useTimeZone.ts`.
 */
export function subscribeToTimeZone(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** How many times the page has had to be redrawn for the account's zone. */
export const timeZoneRedraws = (): number => redraws

/**
 * A moment in time, written in the zone the person chose. Takes the same options as
 * `toLocaleString`; with none it is the date and the time ("27 Oct 2026, 14:32").
 */
export function formatInstant(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const shown = options && Object.keys(options).length > 0 ? options : ({ dateStyle: "medium", timeStyle: "short" } as const)
  return date.toLocaleString(undefined, { ...shown, timeZone: displayTimeZone() })
}
