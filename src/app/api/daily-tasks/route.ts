import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import {
  DAILY_TASKS_MESSAGES,
  ISO_DATE_PATTERN,
  MAX_TASKS_PER_SUBMIT,
  MAX_TODAY_DRIFT_DAYS,
  TASK_MAX_LENGTH,
} from "@/constants/dailyTasks"
import { shiftDate } from "@/lib/taskDates"
import { createTasks, deleteTasksBeforeWindow, listTasks } from "@/services/dailyTasks/tasks"

export const dynamic = "force-dynamic"

const PageSchema = z.coerce.number().int().positive().catch(1)

const IsoDate = z
  .string()
  .trim()
  .regex(ISO_DATE_PATTERN, DAILY_TASKS_MESSAGES.invalidDate)
  // Rejects a real-looking date that isn't a real day, e.g. 2026-02-31. Zod still runs this when
  // the pattern above failed, so it must cope with text that is no date at all.
  .refine((date) => {
    const timestamp = Date.parse(`${date}T00:00:00Z`)
    return !Number.isNaN(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date
  }, DAILY_TASKS_MESSAGES.invalidDate)

/**
 * The browser sends the day its own clock is on, so a task lands on the day the user is living
 * in whatever timezone the server runs in. Any timezone is at most a day from UTC, so a "today"
 * further away than that is not a clock difference and is refused.
 */
const TodaySchema = IsoDate.refine((date) => {
  const utcToday = new Date().toISOString().slice(0, 10)
  return date >= shiftDate(utcToday, -MAX_TODAY_DRIFT_DAYS) && date <= shiftDate(utcToday, MAX_TODAY_DRIFT_DAYS)
}, DAILY_TASKS_MESSAGES.invalidDate)

const CreateSchema = z
  .object({
    today: TodaySchema,
    taskDate: IsoDate,
    contents: z
      .array(z.string().max(TASK_MAX_LENGTH, DAILY_TASKS_MESSAGES.contentTooLong))
      .min(1, DAILY_TASKS_MESSAGES.missingContent)
      .max(MAX_TASKS_PER_SUBMIT, DAILY_TASKS_MESSAGES.tooManyTasks),
  })
  // A task belongs to a day that has happened: a later one would never show in the seven-day view
  .refine((body) => body.taskDate <= body.today, { message: DAILY_TASKS_MESSAGES.futureDate, path: ["taskDate"] })

// Empty rows are dropped, and the same task written twice in one submission is kept once
function cleanContents(contents: string[]): string[] {
  const seen = new Set<string>()
  const kept: string[] = []
  for (const content of contents) {
    const task = content.trim().replace(/\s+/g, " ")
    const key = task.toLowerCase()
    if (!task || seen.has(key)) continue
    seen.add(key)
    kept.push(task)
  }
  return kept
}

const badRequest = (message: string) => NextResponse.json({ success: false, message }, { status: 400 })

/**
 * GET (?today=YYYY-MM-DD&page=1): one page of tasks, newest day first. Page 1 is the last seven
 * days; later pages are older days, a week at a time.
 */
export async function GET(req: NextRequest) {
  try {
    const today = TodaySchema.safeParse(req.nextUrl.searchParams.get("today"))
    if (!today.success) return badRequest(DAILY_TASKS_MESSAGES.invalidDate)

    const page = PageSchema.parse(req.nextUrl.searchParams.get("page") ?? 1)
    const tasks = await listTasks(today.data, page)
    return NextResponse.json({ success: true, message: "Tasks retrieved", data: tasks })
  } catch (error: unknown) {
    console.error("GET Daily Tasks Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, DAILY_TASKS_MESSAGES.loadFailed) },
      { status: 500 }
    )
  }
}

/**
 * POST: adds a day's tasks in one go. Empty rows are ignored, so the composer can keep spare
 * rows on screen, and a row repeated in the same submission is saved once.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || DAILY_TASKS_MESSAGES.missingContent)

    const contents = cleanContents(parsed.data.contents)
    if (contents.length === 0) return badRequest(DAILY_TASKS_MESSAGES.missingContent)

    const tasks = await createTasks(parsed.data.taskDate, contents)
    return NextResponse.json({ success: true, message: DAILY_TASKS_MESSAGES.saved, data: { tasks } }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Daily Tasks Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, DAILY_TASKS_MESSAGES.saveFailed) },
      { status: 500 }
    )
  }
}

/**
 * DELETE (?today=YYYY-MM-DD): deletes every task older than the seven-day window. The page asks
 * for confirmation before calling this; today and the six days before it are never touched.
 */
export async function DELETE(req: NextRequest) {
  try {
    const today = TodaySchema.safeParse(req.nextUrl.searchParams.get("today"))
    if (!today.success) return badRequest(DAILY_TASKS_MESSAGES.invalidDate)

    const deleted = await deleteTasksBeforeWindow(today.data)
    return NextResponse.json({
      success: true,
      message: deleted > 0 ? DAILY_TASKS_MESSAGES.cleaned : DAILY_TASKS_MESSAGES.nothingToClean,
      data: { deleted },
    })
  } catch (error: unknown) {
    console.error("DELETE Daily Tasks Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, DAILY_TASKS_MESSAGES.cleanupFailed) },
      { status: 500 }
    )
  }
}
