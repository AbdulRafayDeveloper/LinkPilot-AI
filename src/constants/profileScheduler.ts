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

// Comment Writer reads these from its address when a profile is opened from the scheduler
export const PROFILE_PARAM = "profile"
export const DAY_PARAM = "day"

export const PROFILE_SCHEDULER_MESSAGES = {
  missingUrl: "Paste the LinkedIn profile link.",
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
  openAllHint: (count: number) =>
    `Opens the ${count === 1 ? "profile" : `${count} profiles`} on this page on LinkedIn, one tab every ${OPEN_ALL_GAP_MS / 1000} seconds.`,
  opening: (opened: number, total: number) => `Opened ${opened} of ${total} on LinkedIn. The next one opens in ${OPEN_ALL_GAP_MS / 1000} seconds.`,
  // A browser lets a page open a tab by itself only once the site is allowed pop-ups, so the rest go one click each
  popupsBlocked: (opened: number, total: number) =>
    `Opened ${opened} of ${total}. Your browser stops this page opening tabs by itself, so open the rest one click at a time below, or allow pop-ups for this site and press Open all again.`,
  openedAll: (count: number) => `Opened ${count} ${count === 1 ? "profile" : "profiles"} on LinkedIn.`,
  stopped: (opened: number, total: number) => `Stopped after ${opened} of ${total}.`,
} as const

/**
 * The pause between two profiles Open all opens. Opening profiles from their links in your own
 * signed-in browser is ordinary browsing; the gap keeps it at a person's pace rather than a burst of
 * tabs, and it is well above the one-second floor a background tab's timers are held to.
 */
export const OPEN_ALL_GAP_MS = 2000

// How to let the site open tabs by itself, in Chrome and Edge, where the blocked-pop-up icon is easy to miss
export const allowPopupsSteps = (host: string) => [
  "Click the small window icon with a red cross at the right end of the address bar (it shows after tabs were blocked).",
  `Choose "Always allow pop-ups and redirects from ${host}", then Done.`,
  `No icon? Open Chrome's Settings, Privacy and security, Site settings, Pop-ups and redirects, and add ${host} under "Allowed to send pop-ups".`,
  "Come back here and press Open all again.",
]
