import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { TaskFiltersSchema } from "@/lib/validation/dailyTasks"
import { DAILY_TASKS_MESSAGES } from "@/constants/dailyTasks"
import { readTaskFilters, saveTaskFilters } from "@/services/dailyTasks/filterChoice"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * What Daily Tasks is narrowed to, kept on the account so it is still on after moving to another
 * page, reloading, or signing out and back in.
 *
 * It sits under `/api/daily-tasks`, which `FEATURE_API_PATHS` already maps to that tool, so an
 * account the tool is turned off for is refused here as well without naming it.
 */

/** GET: the narrowing to open the list on, every field "" when nothing is narrowed. */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    return NextResponse.json({ success: true, message: "Filters retrieved", data: await readTaskFilters(auth.viewer) })
  } catch (error: unknown) {
    console.error("GET Daily Task Filters Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, DAILY_TASKS_MESSAGES.filtersSaveFailed) },
      { status: 500 }
    )
  }
}

/**
 * PUT `{ priority?, doer?, blocked?, done? }`: keeps what is narrowed now. Clearing the filters is
 * the same call with every field empty, so showing everything again is remembered too, and sending
 * the same narrowing twice changes nothing.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = TaskFiltersSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message || DAILY_TASKS_MESSAGES.invalidFilters },
      { status: 400 }
    )
  }
  try {
    return NextResponse.json({ success: true, message: "Filters saved", data: await saveTaskFilters(auth.viewer, parsed.data) })
  } catch (error: unknown) {
    console.error("PUT Daily Task Filters Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, DAILY_TASKS_MESSAGES.filtersSaveFailed) },
      { status: 500 }
    )
  }
}
