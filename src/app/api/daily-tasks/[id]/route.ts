import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { DAILY_TASKS_MESSAGES } from "@/constants/dailyTasks"
import { TASK_ATTACHMENT_MESSAGES } from "@/constants/taskAttachments"
import {
  deleteTask,
  setTaskBlocked,
  setTaskCompletion,
  setTaskDetails,
  setTaskDoer,
  setTaskPriority,
  setTaskRepeat,
  taskLineage,
} from "@/services/dailyTasks/tasks"
import { TaskBlockedSchema, TaskDoerSchema, TaskPrioritySchema, TaskRepeatSchema } from "@/lib/validation/dailyTasks"
import { writeTaskDetails } from "@/services/dailyTasks/writeDetails"
import { TaskDetailsEditSchema } from "@/lib/validation/taskAttachment"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest } from "@/services/modelPriority"

export const dynamic = "force-dynamic"

const CompletionSchema = z.object({ isCompleted: z.boolean() })

const notFound = () => NextResponse.json({ success: false, message: DAILY_TASKS_MESSAGES.invalidTask }, { status: 404 })

/**
 * PUT: one of three changes to one task, told apart by what the body carries.
 * - `{ isCompleted }` ticks it off or reopens it, writing only the completion fields, so the checkbox
 *   stays a single small update and repeating it lands on the same state.
 * - `{ priority }` changes how urgent it is, the same way and for the same reason: one field, so a
 *   change made on the list can never carry a stale line or description over another tab's save.
 * - `{ doer }` changes who does it (me or an employee), which is its own one-field write for exactly
 *   the same reason, and `{ isBlocked }` or `{ repeat }` blocks it, or sets how often it comes
 *   back, the same way again.
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

    const named = (field: string) => body !== null && typeof body === "object" && field in body

    // How urgent it is, on its own: the list's own control, which never sends anything else
    if (named("priority") && !named("isCompleted") && !named("description")) {
      const parsed = TaskPrioritySchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || DAILY_TASKS_MESSAGES.updateFailed }, { status: 400 })
      }
      const task = await setTaskPriority(auth.viewer, id, parsed.data.priority)
      if (!task) return notFound()
      return NextResponse.json({ success: true, message: "Task updated", data: task })
    }

    // Who does it, on its own: the list's other control, which never sends anything else either
    if (named("doer") && !named("isCompleted") && !named("description")) {
      const parsed = TaskDoerSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || DAILY_TASKS_MESSAGES.updateFailed }, { status: 400 })
      }
      const task = await setTaskDoer(auth.viewer, id, parsed.data.doer)
      if (!task) return notFound()
      return NextResponse.json({ success: true, message: "Task updated", data: task })
    }

    // Blocked or not, on its own: the row's own toggle, which never sends anything else either
    if (named("isBlocked") && !named("isCompleted") && !named("description")) {
      const parsed = TaskBlockedSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || DAILY_TASKS_MESSAGES.updateFailed }, { status: 400 })
      }
      const task = await setTaskBlocked(auth.viewer, id, parsed.data.isBlocked)
      if (!task) return notFound()
      return NextResponse.json({ success: true, message: "Task updated", data: task })
    }

    // How often it repeats, on its own, like the rest of the row's own controls
    if ((named("repeat") || named("repeats")) && !named("isCompleted") && !named("description")) {
      const parsed = TaskRepeatSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || DAILY_TASKS_MESSAGES.updateFailed }, { status: 400 })
      }
      const task = await setTaskRepeat(auth.viewer, id, parsed.data.repeat)
      if (!task) return notFound()
      return NextResponse.json({ success: true, message: "Task updated", data: task })
    }

    // A tick always names isCompleted; anything else is an edit of the task
    if (!named("isCompleted")) {
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
      { status: error instanceof UserFacingError && error.message === TASK_ATTACHMENT_MESSAGES.imageNotYours ? 400 : 500 }
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
