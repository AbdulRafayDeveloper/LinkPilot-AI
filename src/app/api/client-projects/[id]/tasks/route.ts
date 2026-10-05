import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { ProjectTaskSchema } from "@/lib/validation/clientProjectTasks"
import { PROJECT_TASK_MESSAGES } from "@/constants/clientProjectTasks"
import { addProjectTask } from "@/services/clientProjects/tasks"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

/** POST: adds one task to the end of a project's list, with its images and voice note if it has any. */
async function handlePost(req: NextRequest, context: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ProjectTaskSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || PROJECT_TASK_MESSAGES.saveFailed }, { status: 400 })
  }
  try {
    const task = await addProjectTask(auth.viewer, (await context.params).id, parsed.data)
    return task
      ? NextResponse.json({ success: true, message: PROJECT_TASK_MESSAGES.created, data: task }, { status: 201 })
      : NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.projectNotFound }, { status: 404 })
  } catch (error: unknown) {
    if (error instanceof UserFacingError) return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    console.error("POST Client Project Task Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_TASK_MESSAGES.saveFailed) }, { status: 500 })
  }
}

// A retry of the same request (same Idempotency-Key) gets the first answer back instead of adding the task twice
export const POST = withIdempotency("client-project-tasks", handlePost)
