import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { ProjectInputSchema } from "@/lib/validation/promptProjects"
import { PROMPT_PROJECT_MESSAGES } from "@/constants/promptProjects"
import { createProject, listProjects } from "@/services/promptCreator/projects"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

/** GET: Every project of the Prompt Creator, by name, each with how many prompts it holds. */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const projects = await listProjects(auth.viewer)
    return NextResponse.json({ success: true, message: "Projects retrieved", data: { projects } })
  } catch (error: unknown) {
    console.error("GET Prompt Projects Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROMPT_PROJECT_MESSAGES.loadFailed) }, { status: 500 })
  }
}

/** POST (body: { name, instructions? }): Adds a project. A name already in use answers 409. */
async function handlePost(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ProjectInputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || PROMPT_PROJECT_MESSAGES.createFailed }, { status: 400 })
  }

  try {
    const project = await createProject(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: `Project "${project.name}" created.`, data: project }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof UserFacingError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.message === PROMPT_PROJECT_MESSAGES.duplicate ? 409 : 400 })
    }
    console.error("POST Prompt Project Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROMPT_PROJECT_MESSAGES.createFailed) }, { status: 500 })
  }
}

// A retry of the same create (same Idempotency-Key) gets the first answer back instead of making two
export const POST = withIdempotency("prompt-creator:projects", handlePost)
