import { CalendarPlus, type LucideIcon } from "lucide-react"

/**
 * Meeting Planner & Preparation: meetings that haven't happened yet. A meeting is a name, a day
 * and a time; everything else is optional. When preparation is switched on, the lead's own
 * information plus the user's saved context (About Me and Rafay Profile Info) become a read of
 * the person and a plan for the conversation, saved with the meeting so it is written once.
 *
 * The other meetings module (`constants/meetings.ts`) is the opposite end: a transcript of a
 * meeting that already happened. These two never share data.
 */
export const MEETING_NAME_MAX_LENGTH = 160
export const PERSON_NAME_MAX_LENGTH = 120
// The three optional preparation inputs; a LinkedIn profile and a long chat both fit
export const PREP_INPUT_MAX_LENGTH = 30_000
// How far the calendar goes in either direction, so a year of meetings stays reachable
export const CALENDAR_MONTH_RANGE = 12
// Meetings shown inside one calendar day before the cell offers the rest
export const DAY_CELL_MAX_MEETINGS = 3

// A calendar day and a wall-clock time, both as the browser's own clock sees them
export const ISO_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
// A month, as the calendar asks for it
export const ISO_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
// How far a browser's "today" may sit from the server's UTC day (any timezone is at most a day)
export const MAX_TODAY_DRIFT_DAYS = 1

/**
 * Where the meeting itself is: it has either happened or it hasn't. This is the user's own
 * marker and never changes on its own.
 */
export const MEETING_PLAN_STATUSES = [
  { id: "pending", label: "Pending", description: "Not held yet" },
  { id: "completed", label: "Completed", description: "The meeting took place" },
] as const

export type MeetingPlanStatusId = (typeof MEETING_PLAN_STATUSES)[number]["id"]
export const MEETING_PLAN_STATUS_IDS = MEETING_PLAN_STATUSES.map((status) => status.id) as [
  MeetingPlanStatusId,
  ...MeetingPlanStatusId[],
]
export const DEFAULT_MEETING_PLAN_STATUS: MeetingPlanStatusId = "pending"

/**
 * Where the preparation is. "queued" is switched on but not written yet, "generating" is a run
 * actually in flight. It is written once and kept; a failed run leaves the meeting itself
 * untouched and can be run again.
 */
export const PREP_STATUSES = ["off", "queued", "generating", "ready", "failed"] as const
export type PrepStatusId = (typeof PREP_STATUSES)[number]

// A serverless function can be killed mid-run, which would leave a meeting "generating" for
// good. A run older than the route's own limit plus a margin is treated as gone, not running.
export const STALE_PREP_MS = 6 * 60_000

export const MEETING_PLANNER_ENDPOINT = "/api/meeting-planner"

// The preparation prompt the user can edit, in the shared prompts modal
export const MEETING_PLANNER_PROMPT_TABS = [{ id: "preparation", label: "Meeting preparation" }] as const
export type MeetingPlannerPromptId = (typeof MEETING_PLANNER_PROMPT_TABS)[number]["id"]
export const MEETING_PLANNER_PROMPT_IDS = MEETING_PLANNER_PROMPT_TABS.map((tab) => tab.id) as [
  MeetingPlannerPromptId,
  ...MeetingPlannerPromptId[],
]

export const MEETING_PLANNER_MESSAGES = {
  missingName: "Give the meeting a name.",
  nameTooLong: `The meeting name must be under ${MEETING_NAME_MAX_LENGTH} characters.`,
  invalidDate: "Pick a valid meeting date.",
  invalidTime: "Pick a valid meeting time.",
  invalidMonth: "That month can't be shown.",
  inputTooLong: `Each preparation field must be under ${PREP_INPUT_MAX_LENGTH.toLocaleString()} characters.`,
  prepNeedsInput:
    "Preparation needs something to work from: add the person's profile, your conversation so far, or anything else that matters.",
  notFound: "That meeting no longer exists.",
  created: "Meeting saved.",
  updated: "Meeting updated.",
  deleted: "Meeting deleted.",
  statusUpdated: "Status updated.",
  saveFailed: "Couldn't save the meeting. Please try again.",
  loadFailed: "Couldn't load your meetings.",
  updateFailed: "Couldn't update the meeting. Please try again.",
  deleteFailed: "Couldn't delete the meeting. Please try again.",
  prepFailed: "The preparation didn't finish. The meeting is saved, so you can run it again.",
  prepRunning: "Preparation is already running for this meeting.",
  prepOff: "Preparation is switched off for this meeting.",
  prepReady: "Preparation ready.",
  emptyToday: "Nothing scheduled today.",
  emptyMonth: "No meetings this month.",
  emptyDay: "Nothing scheduled on this day.",
} as const

// The module's sidebar entry, next to the meeting minutes module
export const MEETING_PLANNER_TOOL: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: "clients"
} = {
  id: "meeting-planner",
  title: "Meeting Planner",
  description: "Schedule & prepare meetings",
  icon: CalendarPlus,
  href: "/meeting-planner",
  group: "clients",
}
