import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { DAILY_TASKS_MESSAGES } from "@/constants/dailyTasks"
import { MoveOverdueSchema } from "@/lib/validation/dailyTasks"
import { moveOverdueToToday } from "@/services/dailyTasks/tasks"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * POST (body: { today, ids? }): brings the tasks left open on earlier days onto today, each with its
 * subtasks, at the end of today's list. Without `ids` every overdue task moves; with them only those,
 * which is the button on one row. A repeat moves nothing, because nothing is overdue any more, so the
 * browser may safely send it again.
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = MoveOverdueSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || DAILY_TASKS_MESSAGES.moveFailed }, { status: 400 })
  }

  try {
    const { moved } = await moveOverdueToToday(auth.viewer, parsed.data.today, parsed.data.ids)
    return NextResponse.json({ success: true, message: DAILY_TASKS_MESSAGES.movedOverdue(moved), data: { moved } })
  } catch (error: unknown) {
    console.error("POST Move Overdue Daily Tasks Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, DAILY_TASKS_MESSAGES.moveFailed) }, { status: 500 })
  }
}
