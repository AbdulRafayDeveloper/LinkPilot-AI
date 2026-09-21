import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { DAILY_TASKS_MESSAGES } from "@/constants/dailyTasks"
import { TASK_ATTACHMENT_MESSAGES } from "@/constants/taskAttachments"
import { copyTask } from "@/services/dailyTasks/tasks"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

/**
 * POST: copies a task and everything under it, straight after the original on the same day and
 * under the same parent: its line, description, images (copied, so each keeps its own) and subtasks
 * in the same shape, all open. Answers the copy with its subtasks inside it.
 */
async function handlePost(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const task = await copyTask(auth.viewer, (await params).id)
    if (!task) return NextResponse.json({ success: false, message: DAILY_TASKS_MESSAGES.invalidTask }, { status: 404 })
    return NextResponse.json({ success: true, message: TASK_ATTACHMENT_MESSAGES.copied, data: task }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Copy Daily Task Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, TASK_ATTACHMENT_MESSAGES.copyFailed) }, { status: 500 })
  }
}

// A retry of the same click (same Idempotency-Key) gets the first copy back rather than making a second
export const POST = withIdempotency("daily-tasks-copy", handlePost)
