import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { DAILY_TASKS_MESSAGES } from "@/constants/dailyTasks"
import { deleteTask, setTaskCompletion, setTaskDetails, taskLineage } from "@/services/dailyTasks/tasks"
import { writeTaskDetails } from "@/services/dailyTasks/writeDetails"
import { TaskDetailsEditSchema } from "@/lib/validation/taskAttachment"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest } from "@/services/modelPriority"

export const dynamic = "force-dynamic"

const CompletionSchema = z.object({ isCompleted: z.boolean() })

const notFound = () => NextResponse.json({ success: false, message: DAILY_TASKS_MESSAGES.invalidTask }, { status: 404 })

/**
 * PUT: one of two changes to one task, told apart by what the body carries.
 * - `{ isCompleted }` ticks it off or reopens it, writing only the completion fields, so the checkbox
 *   stays a single small update and repeating it lands on the same state.
 * - `{ description, images, content? }` saves the task from its editor (the editor sends it as it is
 *   typed, so this is also its auto-save). The first version's `{ description, image }` still works.
 *   The description and the images (or image) are always sent, so a body that left them out cannot
 *   clear them by accident; `content`, left out, keeps the task's line. With `generateAI: true` the
 *   description is written with AI from the task's line and the tasks above it, and saved with the rest.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const { id } = await params

    // A tick always names isCompleted; anything else is an edit of the task
    if (!(body !== null && typeof body === "object" && "isCompleted" in body)) {
      const details = TaskDetailsEditSchema.safeParse(body)
      if (!details.success) {
        return NextResponse.json({ success: false, message: details.error.issues[0]?.message || DAILY_TASKS_MESSAGES.detailsFailed }, { status: 400 })
      }
      const { description, image, images, content, generateAI } = details.data
      let written = description
      if (generateAI) {
        const lineage = await taskLineage(auth.viewer, id)
        if (!lineage) return notFound()
        const answer = await runAiRequest(auth.viewer, "daily-tasks", () =>
          writeTaskDetails({ title: content ?? lineage.title, parents: lineage.parents, description, signal: req.signal })
        )
        written = answer.result.details
      }
      const task = await setTaskDetails(auth.viewer, id, { description: written, images: images ?? (image ? [image] : []), content })
      if (!task) return notFound()
      return NextResponse.json({ success: true, message: DAILY_TASKS_MESSAGES.detailsSaved, data: task })
    }

    const parsed = CompletionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: DAILY_TASKS_MESSAGES.updateFailed }, { status: 400 })
    }

    const task = await setTaskCompletion(auth.viewer, id, parsed.data.isCompleted)
    if (!task) return notFound()
    return NextResponse.json({ success: true, message: "Task updated", data: task })
  } catch (error: unknown) {
    console.error("PUT Daily Task Exception:", error)
    return NextResponse.json(
      // A failure while writing with AI arrives as a message of its own and is passed on as it is
      { success: false, message: toUserFacingMessage(error, DAILY_TASKS_MESSAGES.updateFailed) },
      { status: 500 }
    )
  }
}

/**
 * DELETE: removes one task and everything under it. The page deletes on one click and puts the task
 * back if this fails, the way one saved note behaves.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const { id } = await params
    const deleted = await deleteTask(auth.viewer, id)
    if (!deleted) return notFound()
    return NextResponse.json({ success: true, message: DAILY_TASKS_MESSAGES.taskDeleted, data: { deleted: true } })
  } catch (error: unknown) {
    console.error("DELETE Daily Task Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, DAILY_TASKS_MESSAGES.deleteFailed) },
      { status: 500 }
    )
  }
}
