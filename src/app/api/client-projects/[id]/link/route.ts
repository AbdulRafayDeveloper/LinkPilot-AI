import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ProjectLinkSchema } from "@/lib/validation/clientProjectTasks"
import { PROJECT_TASK_MESSAGES } from "@/constants/clientProjectTasks"
import { changeProjectLink } from "@/services/clientProjects/projects"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST (body: { action }): makes a project's read-only link, replaces it, or turns it off.
 * **replace** stops every earlier link at once; **disable** stops them all and turning it on again
 * makes one nobody has seen. The answer carries the token, which the page puts after its own origin.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ProjectLinkSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || PROJECT_TASK_MESSAGES.linkFailed }, { status: 400 })
  }
  try {
    const result = await changeProjectLink(auth.viewer, (await params).id, parsed.data.action)
    return result
      ? NextResponse.json({ success: true, message: parsed.data.action === "disable" ? PROJECT_TASK_MESSAGES.linkOff : PROJECT_TASK_MESSAGES.linkReplaced, data: result })
      : NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.projectNotFound }, { status: 404 })
  } catch (error: unknown) {
    console.error("POST Client Project Link Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_TASK_MESSAGES.linkFailed) }, { status: 500 })
  }
}
