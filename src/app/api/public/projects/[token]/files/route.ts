import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { PROJECT_TASK_MESSAGES, PUBLIC_PROJECT_MESSAGES } from "@/constants/clientProjectTasks"
import { ProjectFilePlanSchema } from "@/lib/validation/clientProjectTasks"
import { planProjectFile } from "@/services/clientProjects/files"
import { projectFromToken } from "@/services/clientProjects/projects"

export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store" }

/**
 * POST: checks a file the client wants to attach from a project's shared link and answers how to
 * send it. The bytes then go to `./[assetId]` a chunk at a time.
 *
 * **Nobody is signed in here, so the project's signed token is what is checked, before anything is
 * written**, the same rule the images and the voice note follow. The type, the ceiling and the id
 * are all the server's: the client says what the file is called and how big it is, and is told what
 * to do, or refused.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const parsed = ProjectFilePlanSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || PROJECT_TASK_MESSAGES.fileUploadFailed }, { status: 400, headers: noStore })
  }
  try {
    const project = await projectFromToken(token)
    if (!project) return NextResponse.json({ success: false, message: PUBLIC_PROJECT_MESSAGES.invalid }, { status: 404, headers: noStore })
    const plan = await planProjectFile({ id: project._id.toString(), ownerId: project.ownerId ?? null }, parsed.data)
    return NextResponse.json({ success: true, message: "Upload ready", data: plan }, { status: 201, headers: noStore })
  } catch (error: unknown) {
    if (error instanceof UserFacingError) return NextResponse.json({ success: false, message: error.message }, { status: 400, headers: noStore })
    console.error("POST Public Project File Plan Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_TASK_MESSAGES.fileUploadFailed) }, { status: 500, headers: noStore })
  }
}
