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

/**
 * What a person is, in plain words, so a row says for itself why it is on the list. A person can be
 * more than one: an agency owner who posts every day is an Agency and a Creator. These replaced the
 * outreach sheet's own headings (Signal, Reach, Referral), which said nothing about the person;
 * `TYPE_ALIASES` still reads those words, so a sheet written with them imports as it always did.
 */
export const PERSON_TYPES = [
  { id: "funded-founder", label: "Funded Founder", description: "Just raised, so there is a reason to reach out now" },
  { id: "investor", label: "Investor", description: "VC, angel or fundraising advisor whose posts founders read" },
  { id: "creator", label: "Creator", description: "Large following, so a comment is seen by their audience" },
  { id: "agency", label: "Agency", description: "Runs an agency or consultancy and can pass client work on" },
] as const

export type PersonTypeId = (typeof PERSON_TYPES)[number]["id"]
export const PERSON_TYPE_IDS = PERSON_TYPES.map((type) => type.id) as [PersonTypeId, ...PersonTypeId[]]

// The outreach sheet's older headings, and the short words a sheet may use, read as the types above
export const TYPE_ALIASES: Record<string, PersonTypeId> = {
  signal: "funded-founder",
  reach: "creator",
  referral: "agency",
  founder: "funded-founder",
  funded: "funded-founder",
  vc: "investor",
  angel: "investor",
  consultancy: "agency",
}

// Name, role, company, location, sector and the date are one line each
export const PERSON_FIELD_MAX_LENGTH = 150

// Why now and the notes are a sentence or two; the source is a link to where the person was found
export const PERSON_TEXT_MAX_LENGTH = 500

/**
 * How many people a page holds. The list is long (a whole week of outreach), so it opens on 100 and
 * the page offers the others; anything else asked for falls back to the default rather than being
 * refused, and the service caps what it reads at the largest of these.
 */
export const PROFILE_PAGE_SIZES = [25, 50, 100, 200] as const
export const DEFAULT_PROFILE_PAGE_SIZE = 100

// Comment Writer reads these from its address when a profile is opened from the scheduler
export const PROFILE_PARAM = "profile"
export const DAY_PARAM = "day"

export const PROFILE_SCHEDULER_MESSAGES = {
  // A new person is saved with their link; the ones imported without one keep their Add link button
  missingUrl: "Paste the LinkedIn profile link.",
  openOnLinkedIn: "Open on LinkedIn",
  badUrl: "That isn't a LinkedIn profile link. It looks like https://www.linkedin.com/in/their-name.",
  urlTooLong: `A profile link is at most ${PROFILE_URL_MAX_LENGTH} characters.`,
  missingPerson: "Add the person's name or their LinkedIn profile link.",
  fieldTooLong: `Name, role, company, location, sector and the date are at most ${PERSON_FIELD_MAX_LENGTH} characters each.`,
  textTooLong: `Why now and the notes are at most ${PERSON_TEXT_MAX_LENGTH} characters each.`,
  badSource: "The source is a web address, starting http:// or https://.",
  badType: `That isn't a type this list uses (${PERSON_TYPES.map((type) => type.label).join(", ")}).`,
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
