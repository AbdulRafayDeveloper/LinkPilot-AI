import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PROMPT_PROJECT_MESSAGES } from "@/constants/promptCreator"
import { listPromptProjects } from "@/services/clients/projects"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: every project a prompt can be written for, which is **the clients' own projects** (Clients
 * Management, `client_projects`), each with its client's name, its standing instructions and how
 * many prompts have been written for it.
 *
 * It is read-only on purpose. A project is made, renamed and deleted with its client, so there is
 * one place it exists; the Projects module that used to own a second list of its own is gone, at the
 * owner's request. The path stays under `/api/prompt-creator` because it serves that tool's picker,
 * which is also what gates it (`FEATURE_API_PATHS`).
 */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const projects = await listPromptProjects(auth.viewer)
    return NextResponse.json({ success: true, message: "Projects retrieved", data: { projects } })
  } catch (error: unknown) {
    console.error("GET Prompt Projects Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROMPT_PROJECT_MESSAGES.loadFailed) }, { status: 500 })
  }
}
