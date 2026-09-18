import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { DAILY_TASKS_MESSAGES, MAX_TASKS_PER_SUBMIT, TASK_MAX_LENGTH } from "@/constants/dailyTasks"
import { IsoDate, TodaySchema } from "@/lib/validation/dailyTasks"
import { TaskDetailsSchema } from "@/lib/validation/taskAttachment"
import type { NewDailyTask } from "@/types/dailyTasks"
import { createTasks, deleteTasks, deleteTasksBeforeWindow, listTasks } from "@/services/dailyTasks/tasks"
import { BulkDeleteSchema } from "@/lib/validation/listFilters"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

const PageSchema = z.coerce.number().int().positive().catch(1)

export const CreateSchema = z
  .object({
    today: TodaySchema,
    taskDate: IsoDate,
    // A row is its line plus whatever optional detail was opened on it. A plain string is still
    // accepted for a row with nothing extra, so anything that posted a list of lines before this
    // existed goes on working unchanged
    contents: z
      .array(
        z.union([
          z.string().max(TASK_MAX_LENGTH, DAILY_TASKS_MESSAGES.contentTooLong),
          z
            .object({ content: z.string().max(TASK_MAX_LENGTH, DAILY_TASKS_MESSAGES.contentTooLong) })
            .and(TaskDetailsSchema),
        ])
      )
      .min(1, DAILY_TASKS_MESSAGES.missingContent)
      .max(MAX_TASKS_PER_SUBMIT, DAILY_TASKS_MESSAGES.tooManyTasks),
  })
  // A task belongs to a day that has happened: a later one would never show in the seven-day view
  .refine((body) => body.taskDate <= body.today, { message: DAILY_TASKS_MESSAGES.futureDate, path: ["taskDate"] })

type SubmittedRow = string | ({ content: string } & { description: string; image: { assetId: string; contentType: string } | null })

/**
 * Empty rows are dropped, and the same task written twice in one submission is kept once. A row
 * repeated with detail on it keeps the first one, exactly as a repeated line always has: the line
 * is what decides whether it is the same task.
 */
function cleanContents(contents: SubmittedRow[]): NewDailyTask[] {
  const seen = new Set<string>()
  const kept: NewDailyTask[] = []
  for (const row of contents) {
    const line = typeof row === "string" ? row : row.content
    const task = line.trim().replace(/\s+/g, " ")
    const key = task.toLowerCase()
    if (!task || seen.has(key)) continue
    seen.add(key)
    kept.push({
      content: task,
      description: typeof row === "string" ? "" : row.description,
      image: typeof row === "string" ? null : row.image,
    })
  }
  return kept
}

const badRequest = (message: string) => NextResponse.json({ success: false, message }, { status: 400 })

/**
 * GET (?today=YYYY-MM-DD&page=1): one page of tasks, newest day first. Page 1 is the last seven
 * days; later pages are older days, a week at a time.
 */
export async function GET(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const today = TodaySchema.safeParse(req.nextUrl.searchParams.get("today"))
    if (!today.success) return badRequest(DAILY_TASKS_MESSAGES.invalidDate)

    const page = PageSchema.parse(req.nextUrl.searchParams.get("page") ?? 1)
    const tasks = await listTasks(auth.viewer, today.data, page)
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
async function handlePost(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || DAILY_TASKS_MESSAGES.missingContent)

    const rows = cleanContents(parsed.data.contents)
    if (rows.length === 0) return badRequest(DAILY_TASKS_MESSAGES.missingContent)

    const tasks = await createTasks(auth.viewer, parsed.data.taskDate, rows)
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
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    // With ids, the ticked tasks go, whatever day they are on; without, the week-old cleanup runs
    const body = await req.json().catch(() => null)
    const ticked = body === null ? null : BulkDeleteSchema.safeParse(body)
    if (ticked?.success && ticked.data.ids) {
      const removed = await deleteTasks(auth.viewer, ticked.data.ids)
      return NextResponse.json({
        success: true,
        message: `${removed} ${removed === 1 ? "task" : "tasks"} deleted.`,
        data: { deleted: removed },
      })
    }

    const today = TodaySchema.safeParse(req.nextUrl.searchParams.get("today"))
    if (!today.success) return badRequest(DAILY_TASKS_MESSAGES.invalidDate)

    const deleted = await deleteTasksBeforeWindow(auth.viewer, today.data)
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

// A retry of the same request (same Idempotency-Key) gets the first answer back instead of running again
export const POST = withIdempotency("daily-tasks", handlePost)
