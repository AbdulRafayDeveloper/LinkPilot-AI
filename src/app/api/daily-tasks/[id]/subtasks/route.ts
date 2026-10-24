import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { DAILY_TASKS_MESSAGES } from "@/constants/dailyTasks"
import { SubtaskOrderSchema } from "@/lib/validation/dailyTasks"
import { reorderSubtasks } from "@/services/dailyTasks/tasks"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * PUT (body: { orderedIds }): the subtasks of the task named by `id`, in the order they are to be
 * worked in, exactly as the page shows them after the drop. It is the subtask side of the move
 * route and moves nothing between days or between parents, which is why it names no date.
 *
 * A task that is gone, or another account's, answers 404; an order that no longer matches that
 * task's children (one added or deleted in another tab) answers 409 and the page reloads. Sending
 * the same order again lands on the same order.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = SubtaskOrderSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || DAILY_TASKS_MESSAGES.invalidSubtaskOrder }, { status: 400 })
  }

  try {
    const { id } = await params
    const result = await reorderSubtasks(auth.viewer, id, parsed.data.orderedIds)
    if ("error" in result) {
      return result.error === "missing"
        ? NextResponse.json({ success: false, message: DAILY_TASKS_MESSAGES.invalidTask }, { status: 404 })
        : NextResponse.json({ success: false, message: DAILY_TASKS_MESSAGES.invalidSubtaskOrder }, { status: 409 })
    }
    return NextResponse.json({ success: true, message: "Subtasks reordered" })
  } catch (error: unknown) {
    console.error("PUT Reorder Daily Subtasks Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, DAILY_TASKS_MESSAGES.moveFailed) }, { status: 500 })
  }
}
