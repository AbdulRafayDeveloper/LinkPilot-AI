import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PROMPT_PROJECT_MESSAGES } from "@/constants/promptProjects"
import { listProjectPrompts } from "@/services/promptCreator/projects"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: The prompts written in one project, newest first, for the project's own list. Editing and
 * deleting one of them go to the prompt's own routes, so there is one place each is done.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const prompts = await listProjectPrompts(auth.viewer, (await params).id)
    if (!prompts) return NextResponse.json({ success: false, message: PROMPT_PROJECT_MESSAGES.notFound }, { status: 404 })
    return NextResponse.json({ success: true, message: "Project prompts retrieved", data: { prompts } })
  } catch (error: unknown) {
    console.error("GET Prompt Project Prompts Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROMPT_PROJECT_MESSAGES.promptsFailed) }, { status: 500 })
  }
}
