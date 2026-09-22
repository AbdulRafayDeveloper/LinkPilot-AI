import { CalendarDays } from "lucide-react"
import type { ToolLink } from "./linkedinTools"

/**
 * Profile Scheduler, a page of Comment Writer: the LinkedIn profiles worth commenting on, each
 * given the days of the week it is looked at. Opening one takes the user to Comment Writer with
 * that profile named, and from there to the profile's posts on LinkedIn. Nothing is generated
 * here. Like every workspace list, a profile belongs to the account that saved it.
 */

export const PROFILE_SCHEDULER_HREF = "/comment-writer/profiles"
export const PROFILE_SCHEDULES_ENDPOINT = "/api/comment-writer/profiles"

// The Comment Writer dropdown's third page, beside New Comment and View All Comments
export const PROFILE_SCHEDULER_LINK: ToolLink = {
  title: "Profile Scheduler",
  description: "Profiles to comment on, by day",
  icon: CalendarDays,
  href: PROFILE_SCHEDULER_HREF,
  pageTitle: "Profile Scheduler",
}

// Monday first, the order days are stored, listed and shown in
export const WEEK_DAYS = [
  { id: "monday", label: "Monday", short: "Mon" },
  { id: "tuesday", label: "Tuesday", short: "Tue" },
  { id: "wednesday", label: "Wednesday", short: "Wed" },
  { id: "thursday", label: "Thursday", short: "Thu" },
  { id: "friday", label: "Friday", short: "Fri" },
  { id: "saturday", label: "Saturday", short: "Sat" },
  { id: "sunday", label: "Sunday", short: "Sun" },
] as const

export type WeekDayId = (typeof WEEK_DAYS)[number]["id"]
export const WEEK_DAY_IDS = WEEK_DAYS.map((day) => day.id) as [WeekDayId, ...WeekDayId[]]
export const WORK_DAY_IDS: WeekDayId[] = ["monday", "tuesday", "wednesday", "thursday", "friday"]

// A profile address is short; this is room for a long name plus the parts of a pasted link that are dropped
export const PROFILE_URL_MAX_LENGTH = 300

// Comment Writer reads these from its address when a profile is opened from the scheduler
export const PROFILE_PARAM = "profile"
export const DAY_PARAM = "day"

export const PROFILE_SCHEDULER_MESSAGES = {
  missingUrl: "Paste the LinkedIn profile link.",
  badUrl: "That isn't a LinkedIn profile link. It looks like https://www.linkedin.com/in/their-name.",
  urlTooLong: `A profile link is at most ${PROFILE_URL_MAX_LENGTH} characters.`,
  missingDays: "Pick at least one day.",
  badDay: "That isn't a day of the week.",
  duplicate: "That profile is already in your list. Edit it to change its days.",
  notFound: "That profile no longer exists.",
  created: "Profile added.",
  updated: "Profile updated.",
  deleted: "Profile deleted.",
  loadFailed: "Couldn't load your profiles.",
  saveFailed: "Couldn't save the profile.",
  deleteFailed: "Couldn't delete the profile.",
  empty: "No profiles yet. Add a LinkedIn profile and the days you want to comment on its posts.",
  noResults: "No profiles match the search or the day.",
} as const
