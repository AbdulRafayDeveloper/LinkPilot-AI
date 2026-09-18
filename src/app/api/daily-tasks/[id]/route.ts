import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { DAILY_TASKS_MESSAGES } from "@/constants/dailyTasks"
import { deleteTask, setTaskCompletion, setTaskDetails } from "@/services/dailyTasks/tasks"
import { TaskDetailsEditSchema } from "@/lib/validation/taskAttachment"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

const CompletionSchema = z.object({ isCompleted: z.boolean() })

/**
 * PUT: one of two small changes to one task, told apart by what the body carries.
 * `{ isCompleted }` ticks it off or reopens it, writing only the completion fields, so the checkbox
 * stays a single small update and repeating it lands on the same state. `{ description, image }`
 * changes the optional detail on it, from its details popup; both fields are required, so a body
 * that left them out cannot clear them by accident.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const { id } = await params

    // A tick always names isCompleted; anything else is an edit of the task's details
    if (!(body !== null && typeof body === "object" && "isCompleted" in body)) {
      const details = TaskDetailsEditSchema.safeParse(body)
      if (!details.success) {
        return NextResponse.json(
          { success: false, message: details.error.issues[0]?.message || DAILY_TASKS_MESSAGES.detailsFailed },
          { status: 400 }
        )
      }
      const task = await setTaskDetails(auth.viewer, id, details.data)
      if (!task) {
        return NextResponse.json({ success: false, message: DAILY_TASKS_MESSAGES.invalidTask }, { status: 404 })
      }
      return NextResponse.json({ success: true, message: DAILY_TASKS_MESSAGES.detailsSaved, data: task })
    }

    const parsed = CompletionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: DAILY_TASKS_MESSAGES.updateFailed }, { status: 400 })
    }

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
