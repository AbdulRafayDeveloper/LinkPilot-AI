import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { ProjectChangesSchema } from "@/lib/validation/promptProjects"
import { PROMPT_PROJECT_MESSAGES } from "@/constants/promptProjects"
import { deleteProject, updateProject } from "@/services/promptCreator/projects"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

const notFound = () => NextResponse.json({ success: false, message: PROMPT_PROJECT_MESSAGES.notFound }, { status: 404 })

/**
 * PUT (body: { name?, instructions? }): Renames a project, changes the instructions every prompt
 * created in it ends with, or both. A name another project has answers 409.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ProjectChangesSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || PROMPT_PROJECT_MESSAGES.saveFailed }, { status: 400 })
  }

  try {
    const project = await updateProject(auth.viewer, (await params).id, parsed.data)
    return project ? NextResponse.json({ success: true, message: "Project saved.", data: project }) : notFound()
  } catch (error: unknown) {
    if (error instanceof UserFacingError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.message === PROMPT_PROJECT_MESSAGES.duplicate ? 409 : 400 })
    }
    console.error("PUT Prompt Project Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROMPT_PROJECT_MESSAGES.saveFailed) }, { status: 500 })
  }
}

/**
 * DELETE: Removes one project. The prompts written in it are kept and go back to no project, so
 * deleting a project can never lose a prompt.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const result = await deleteProject(auth.viewer, (await params).id)
    if (!result) return notFound()
    return NextResponse.json({
      success: true,
      message:
        result.freed > 0
          ? `Project deleted. ${result.freed} ${result.freed === 1 ? "prompt is" : "prompts are"} now in no project.`
          : "Project deleted.",
      data: result,
    })
  } catch (error: unknown) {
    console.error("DELETE Prompt Project Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROMPT_PROJECT_MESSAGES.deleteFailed) }, { status: 500 })
  }
}
