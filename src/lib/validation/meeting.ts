import { z } from "zod"
import {
  MEETING_LINK_MESSAGES,
  MEETING_MESSAGES,
  MEETING_TITLE_MAX_LENGTH,
  PLAN_PICK_REPEAT_IDS,
  PLAN_PICK_WHEN_IDS,
  TRANSCRIPT_MAX_LENGTH,
} from "@/constants/meetings"
import { ISO_DATE_PATTERN, MAX_TODAY_DRIFT_DAYS, MEETING_NAME_MAX_LENGTH, MEETING_PLANNER_MESSAGES } from "@/constants/meetingPlanner"
import { shiftDate } from "@/lib/taskDates"

/**
 * One meeting as the API accepts it. The name is optional, because the analysis writes one when
 * the user does not. The transcript is kept exactly as pasted, apart from trimming the ends.
 */
export const MeetingSchema = z.object({
  title: z.string().trim().max(MEETING_TITLE_MAX_LENGTH, MEETING_MESSAGES.titleTooLong).optional(),
  transcript: z
    .string({ error: MEETING_MESSAGES.missingTranscript })
    .trim()
    .min(1, MEETING_MESSAGES.missingTranscript)
    .max(TRANSCRIPT_MAX_LENGTH, MEETING_MESSAGES.transcriptTooLong),
})

/** Making, replacing or turning off a meeting's share link. */
export const MeetingLinkSchema = z.object({
  action: z.enum(["create", "replace", "disable"], { error: MEETING_LINK_MESSAGES.failed }),
})

/**
 * The day the browser's own clock is on, which is what "past" and "upcoming" are measured from.
 * Any timezone is at most a day from UTC, so anything further is not a clock difference.
 */
const TodaySchema = z
  .string()
  .trim()
  .regex(ISO_DATE_PATTERN, MEETING_PLANNER_MESSAGES.invalidDate)
  .refine((date) => {
    const utcToday = new Date().toISOString().slice(0, 10)
    return date >= shiftDate(utcToday, -MAX_TODAY_DRIFT_DAYS) && date <= shiftDate(utcToday, MAX_TODAY_DRIFT_DAYS)
  }, MEETING_PLANNER_MESSAGES.invalidDate)

/**
 * What the picker asks for: a page of the calendar, grouped by meeting rather than by date.
 *
 * `series` opens one repeating meeting on its own dates, and every filter is kept while it is open,
 * so going back to the list lands on exactly what was being looked at. A value nobody could have
 * picked falls back to the widest one rather than to nothing, the rule the other list filters follow.
 */
export const PlanPickQuerySchema = z.object({
  today: TodaySchema,
  search: z.string().trim().max(MEETING_NAME_MAX_LENGTH).optional().default(""),
  when: z.enum(PLAN_PICK_WHEN_IDS).catch("all"),
  repeat: z.enum(PLAN_PICK_REPEAT_IDS).catch("all"),
  page: z.coerce.number().int().min(1).catch(1),
  // A series id is one the app made itself (a UUID or an object id), never a path or a pattern
  series: z.string().trim().regex(/^[\w-]{8,64}$/).optional(),
})
