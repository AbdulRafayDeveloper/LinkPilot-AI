import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { DAILY_TASKS_MESSAGES } from "@/constants/dailyTasks"
import { deleteTask, setTaskCompletion } from "@/services/dailyTasks/tasks"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

const CompletionSchema = z.object({ isCompleted: z.boolean() })

/**
 * PUT: ticks one task off or reopens it. It writes only the completion fields, so the checkbox
 * stays a single small update, and repeating it lands on the same state.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = CompletionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: DAILY_TASKS_MESSAGES.updateFailed }, { status: 400 })
    }

    const { id } = await params
    const task = await setTaskCompletion(auth.viewer, id, parsed.data.isCompleted)
    if (!task) {
      return NextResponse.json({ success: false, message: DAILY_TASKS_MESSAGES.invalidTask }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: "Task updated", data: task })
  } catch (error: unknown) {
    console.error("PUT Daily Task Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, DAILY_TASKS_MESSAGES.updateFailed) },
      { status: 500 }
    )
  }
}

/**
 * DELETE: removes one task. A task is a single line, so the page deletes it on one click and
 * puts it back if this fails, the way one saved note behaves.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const { id } = await params
    const deleted = await deleteTask(auth.viewer, id)
    if (!deleted) {
      return NextResponse.json({ success: false, message: DAILY_TASKS_MESSAGES.invalidTask }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: DAILY_TASKS_MESSAGES.taskDeleted, data: { deleted: true } })
  } catch (error: unknown) {
    console.error("DELETE Daily Task Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, DAILY_TASKS_MESSAGES.deleteFailed) },
      { status: 500 }
    )
  }
}
