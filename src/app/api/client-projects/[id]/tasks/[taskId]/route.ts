import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { ProjectTaskEditSchema } from "@/lib/validation/clientProjectTasks"
import { PROJECT_TASK_MESSAGES } from "@/constants/clientProjectTasks"
import { deleteProjectTask, updateProjectTask } from "@/services/clientProjects/tasks"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string; taskId: string }> }

const notFound = () => NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.taskNotFound }, { status: 404 })

/**
 * PUT: changes one task. Only the fields in the body are written, so ticking a task off is
 * `{ status }` alone and never has to carry its text, images and voice note back. An image or a
 * voice note the task no longer names is removed from storage once the record is saved.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ProjectTaskEditSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || PROJECT_TASK_MESSAGES.saveFailed }, { status: 400 })
  }
  const { id, taskId } = await params
  try {
    const task = await updateProjectTask(auth.viewer, id, taskId, parsed.data)
    return task ? NextResponse.json({ success: true, message: PROJECT_TASK_MESSAGES.saved, data: task }) : notFound()
  } catch (error: unknown) {
    if (error instanceof UserFacingError) return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    console.error("PUT Client Project Task Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_TASK_MESSAGES.saveFailed) }, { status: 500 })
  }
}

/** DELETE: removes one task, then its images and its voice note. The page confirms first. */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const { id, taskId } = await params
  try {
    const removed = await deleteProjectTask(auth.viewer, id, taskId)
    return removed ? NextResponse.json({ success: true, message: PROJECT_TASK_MESSAGES.deleted, data: { deleted: 1 } }) : notFound()
  } catch (error: unknown) {
    console.error("DELETE Client Project Task Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_TASK_MESSAGES.deleteFailed) }, { status: 500 })
  }
}
