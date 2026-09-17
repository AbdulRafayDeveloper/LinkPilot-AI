import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { DAILY_TASKS_MESSAGES } from "@/constants/dailyTasks"
import { MoveTaskSchema } from "@/lib/validation/dailyTasks"
import { moveTask } from "@/services/dailyTasks/tasks"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * PUT (body: { today, taskDate, orderedIds }): a task dragged to a new place, on its own day or
 * another, with `id` the task that was dragged. `orderedIds` is that day's whole new order, so it
 * says for itself what moved: every id in it that is on another day now arrives on this one. One
 * task and a whole picked group are therefore the same request. A task that is gone answers 404; an
 * order that no longer matches the day (changed in another tab) answers 409, and the page reloads.
 * Sending the same move again lands on the same order.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = MoveTaskSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || DAILY_TASKS_MESSAGES.moveFailed }, { status: 400 })
  }

  try {
    const { id } = await params
    const result = await moveTask(auth.viewer, id, parsed.data.taskDate, parsed.data.orderedIds)
    if ("error" in result) {
      return result.error === "missing"
        ? NextResponse.json({ success: false, message: DAILY_TASKS_MESSAGES.invalidTask }, { status: 404 })
        : NextResponse.json({ success: false, message: DAILY_TASKS_MESSAGES.invalidOrder }, { status: 409 })
    }
    return NextResponse.json({ success: true, message: "Task moved", data: result.task })
  } catch (error: unknown) {
    console.error("PUT Move Daily Task Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, DAILY_TASKS_MESSAGES.moveFailed) }, { status: 500 })
  }
}
