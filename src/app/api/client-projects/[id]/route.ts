import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PROJECT_TASK_MESSAGES } from "@/constants/clientProjectTasks"
import { getProjectWithTasks } from "@/services/clientProjects/projects"
import { tasksOfProject } from "@/services/clientProjects/tasks"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET: one project with its tasks, in the order they are shown, each image and voice note carrying
 * a short-lived link. Another account's project, or one that is gone, reads as not found.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const { id } = await params
  try {
    const [project, tasks] = await Promise.all([getProjectWithTasks(auth.viewer, id), tasksOfProject(auth.viewer, id)])
    if (!project || !tasks) {
      return NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.projectNotFound }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: "Project retrieved", data: { project, tasks } })
  } catch (error: unknown) {
    console.error("GET Client Project Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_TASK_MESSAGES.loadFailed) }, { status: 500 })
  }
}
