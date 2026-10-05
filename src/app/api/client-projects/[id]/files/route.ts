import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { PROJECT_TASK_MESSAGES } from "@/constants/clientProjectTasks"
import { ProjectFilePlanSchema } from "@/lib/validation/clientProjectTasks"
import { planProjectFile } from "@/services/clientProjects/files"
import { projectOrNull } from "@/services/clientProjects/tasks"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * POST: checks a file the page wants to attach to one of this project's items and answers how to
 * send it, `{ assetId, chunkBytes, chunks }`. The bytes then go to `./[assetId]` a chunk at a time.
 *
 * Nothing is stored yet, so a repeat only leaves a row that forgets itself; it is the chunks and
 * the finished file that carry anything.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ProjectFilePlanSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || PROJECT_TASK_MESSAGES.fileUploadFailed }, { status: 400 })
  }
  const { id } = await params
  try {
    const project = await projectOrNull(auth.viewer, id)
    if (!project) return NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.projectNotFound }, { status: 404 })
    const plan = await planProjectFile({ id, ownerId: project.ownerId ?? null }, parsed.data)
    return NextResponse.json({ success: true, message: "Upload ready", data: plan }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof UserFacingError) return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    console.error("POST Client Project File Plan Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_TASK_MESSAGES.fileUploadFailed) }, { status: 500 })
  }
}
