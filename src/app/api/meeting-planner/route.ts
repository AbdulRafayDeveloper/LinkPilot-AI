import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { shiftDate } from "@/lib/taskDates"
import {
  ISO_DATE_PATTERN,
  ISO_MONTH_PATTERN,
  MAX_TODAY_DRIFT_DAYS,
  MEETING_NAME_MAX_LENGTH,
  MEETING_PLANNER_MESSAGES,
  PERSON_NAME_MAX_LENGTH,
  PREP_INPUT_MAX_LENGTH,
  PROFILE_LINK_MAX_LENGTH,
  RECURRENCE_PATTERN_IDS,
  TIME_PATTERN,
} from "@/constants/meetingPlanner"
import { latestUntil, recurrenceDates } from "@/lib/meetingRecurrence"
import { isUsableProfileLink, normalizeProfileLink } from "@/lib/profileLink"
import { createMeeting, listMonth } from "@/services/meetingPlanner/plans"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

/** A real calendar day, e.g. 2026-02-31 is refused. Zod keeps checking after a failed pattern,
 * so this has to cope with text that is no date at all. */
export const IsoDateSchema = z
  .string()
  .trim()
  .regex(ISO_DATE_PATTERN, MEETING_PLANNER_MESSAGES.invalidDate)
  .refine((date) => {
    const timestamp = Date.parse(`${date}T00:00:00Z`)
    return !Number.isNaN(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date
  }, MEETING_PLANNER_MESSAGES.invalidDate)

/**
 * The browser sends the day its own clock is on, so today's meetings are today's for the user.
 * Any timezone is at most a day from UTC, so anything further is not a clock difference.
 */
export const TodaySchema = IsoDateSchema.refine((date) => {
  const utcToday = new Date().toISOString().slice(0, 10)
  return date >= shiftDate(utcToday, -MAX_TODAY_DRIFT_DAYS) && date <= shiftDate(utcToday, MAX_TODAY_DRIFT_DAYS)
}, MEETING_PLANNER_MESSAGES.invalidDate)

const MonthSchema = z.string().trim().regex(ISO_MONTH_PATTERN, MEETING_PLANNER_MESSAGES.invalidMonth)

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, MEETING_PLANNER_MESSAGES.inputTooLong)
    .nullish()
    .transform((value) => value?.trim() || null)

export const MeetingInputSchema = z.object({
  name: z
    .string({ error: MEETING_PLANNER_MESSAGES.missingName })
    .trim()
    .min(1, MEETING_PLANNER_MESSAGES.missingName)
    .max(MEETING_NAME_MAX_LENGTH, MEETING_PLANNER_MESSAGES.nameTooLong),
  meetingDate: IsoDateSchema,
  meetingTime: z.string().trim().regex(TIME_PATTERN, MEETING_PLANNER_MESSAGES.invalidTime),
  personName: optionalText(PERSON_NAME_MAX_LENGTH),
  // Typed, or read out of the pasted profile by the form. "linkedin.com/in/x" is made into an
  // address before it is checked, so a link copied without its scheme is still saved
  profileLink: z
    .string()
    .trim()
    .max(PROFILE_LINK_MAX_LENGTH, MEETING_PLANNER_MESSAGES.profileLinkTooLong)
    .nullish()
    .transform((value) => normalizeProfileLink(value ?? ""))
    .refine((link) => link === "" || isUsableProfileLink(link), MEETING_PLANNER_MESSAGES.profileLinkInvalid)
    .transform((link) => link || null),
  prepEnabled: z.boolean().default(false),
  profileInfo: optionalText(PREP_INPUT_MAX_LENGTH),
  conversationHistory: optionalText(PREP_INPUT_MAX_LENGTH),
  additionalInfo: optionalText(PREP_INPUT_MAX_LENGTH),
})

/**
 * A new meeting may also repeat (optional; without it the request is exactly what it always was).
 * Only the create route takes it, so the edit route's partial schema never offers to turn a saved
 * meeting into a series. The series must end on or after the first meeting, within a month of it,
 * and hold at least two meetings.
 */
export const CreateMeetingSchema = MeetingInputSchema.extend({
  recurrence: z
    .object({
      pattern: z.enum(RECURRENCE_PATTERN_IDS, { error: MEETING_PLANNER_MESSAGES.recurrenceInvalid }),
      until: IsoDateSchema,
    })
    .nullish(),
}).superRefine((body, context) => {
  if (!body.recurrence) return
  const { pattern, until } = body.recurrence
  const fail = (message: string) => context.addIssue({ code: "custom", message, path: ["recurrence", "until"] })
  if (until < body.meetingDate) return fail(MEETING_PLANNER_MESSAGES.recurrenceUntilBefore)
  if (until > latestUntil(body.meetingDate)) return fail(MEETING_PLANNER_MESSAGES.recurrenceUntilTooFar)
  if (recurrenceDates(body.meetingDate, pattern, until).length < 2) fail(MEETING_PLANNER_MESSAGES.recurrenceTooShort)
})

/** Preparation has to have something of the lead's to read; the meeting itself never does. */
export const hasPrepInput = (input: {
  profileInfo: string | null
  conversationHistory: string | null
  additionalInfo: string | null
}): boolean => Boolean(input.profileInfo || input.conversationHistory || input.additionalInfo)

const badRequest = (message: string) => NextResponse.json({ success: false, message }, { status: 400 })

/**
 * GET (?month=YYYY-MM&today=YYYY-MM-DD): the meetings of one month for the calendar, plus
 * today's meetings whatever month is on screen.
 */
export async function GET(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const month = MonthSchema.safeParse(req.nextUrl.searchParams.get("month"))
    const today = TodaySchema.safeParse(req.nextUrl.searchParams.get("today"))
    if (!month.success) return badRequest(MEETING_PLANNER_MESSAGES.invalidMonth)
    if (!today.success) return badRequest(MEETING_PLANNER_MESSAGES.invalidDate)

    const page = await listMonth(auth.viewer, month.data, today.data)
    return NextResponse.json({ success: true, message: "Meetings retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Meeting Planner Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, MEETING_PLANNER_MESSAGES.loadFailed) },
      { status: 500 }
    )
  }
}

/**
 * POST: saves one meeting, or with `recurrence` a whole series of them (see createMeeting), and
 * answers with the first. Only the name, day and time are needed. When preparation is switched
 * on the meeting is saved as "generating" and the page asks for the preparation next, so a slow
 * or failing model can never cost the meeting itself.
 */
async function handlePost(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = CreateMeetingSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || MEETING_PLANNER_MESSAGES.saveFailed)
    if (parsed.data.prepEnabled && !hasPrepInput(parsed.data)) {
      return badRequest(MEETING_PLANNER_MESSAGES.prepNeedsInput)
    }

    const { recurrence, ...input } = parsed.data
    const meeting = await createMeeting(auth.viewer, input, recurrence)
    const message = meeting.seriesSize ? MEETING_PLANNER_MESSAGES.seriesCreated(meeting.seriesSize) : MEETING_PLANNER_MESSAGES.created
    return NextResponse.json({ success: true, message, data: meeting }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Meeting Planner Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, MEETING_PLANNER_MESSAGES.saveFailed) },
      { status: 500 }
    )
  }
}

// A retry of the same request (same Idempotency-Key) gets the first answer back instead of running again
export const POST = withIdempotency("meeting-planner", handlePost)
