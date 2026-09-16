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
  TIME_PATTERN,
} from "@/constants/meetingPlanner"
import { createMeeting, listMonth } from "@/services/meetingPlanner/plans"

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
  prepEnabled: z.boolean().default(false),
  profileInfo: optionalText(PREP_INPUT_MAX_LENGTH),
  conversationHistory: optionalText(PREP_INPUT_MAX_LENGTH),
  additionalInfo: optionalText(PREP_INPUT_MAX_LENGTH),
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
  try {
    const month = MonthSchema.safeParse(req.nextUrl.searchParams.get("month"))
    const today = TodaySchema.safeParse(req.nextUrl.searchParams.get("today"))
    if (!month.success) return badRequest(MEETING_PLANNER_MESSAGES.invalidMonth)
    if (!today.success) return badRequest(MEETING_PLANNER_MESSAGES.invalidDate)

    const page = await listMonth(month.data, today.data)
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
 * POST: saves one meeting. Only the name, day and time are needed. When preparation is switched
 * on the meeting is saved as "generating" and the page asks for the preparation next, so a slow
 * or failing model can never cost the meeting itself.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = MeetingInputSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || MEETING_PLANNER_MESSAGES.saveFailed)
    if (parsed.data.prepEnabled && !hasPrepInput(parsed.data)) {
      return badRequest(MEETING_PLANNER_MESSAGES.prepNeedsInput)
    }

    const meeting = await createMeeting(parsed.data)
    return NextResponse.json({ success: true, message: MEETING_PLANNER_MESSAGES.created, data: meeting }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Meeting Planner Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, MEETING_PLANNER_MESSAGES.saveFailed) },
      { status: 500 }
    )
  }
}
