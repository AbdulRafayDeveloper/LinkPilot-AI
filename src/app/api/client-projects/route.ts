import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PROJECT_TASK_MESSAGES } from "@/constants/clientProjectTasks"
import { listAllProjects } from "@/services/clientProjects/projects"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: every client project the viewer may see, newest first, each with its client's name, how its
 * tasks stand and its read-only link, plus the clients to filter by. The projects themselves are
 * added and removed in Clients Management; this only reads them.
 */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const page = await listAllProjects(auth.viewer)
    return NextResponse.json({ success: true, message: "Projects retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Client Projects Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_TASK_MESSAGES.loadFailed) }, { status: 500 })
  }
}
