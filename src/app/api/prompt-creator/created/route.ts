import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PROMPT_DEPENDENCY_MESSAGES } from "@/constants/promptDependencies"
import { DependencyChoicesQuerySchema } from "@/lib/validation/promptDependencies"
import { dependencyChoices } from "@/services/promptCreator/dependencies"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET (?search=&folder=&exclude=&include=): the prompts one prompt may be told to wait for, newest
 * first and narrowed by a search and a folder (a folder id, "none", or "" for all), with whether each
 * has run. It answers names and marks only, never the prompt texts, because this is what the picker
 * lists and nothing else.
 */
export async function GET(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = DependencyChoicesQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: PROMPT_DEPENDENCY_MESSAGES.loadFailed }, { status: 400 })
  }
  try {
    const prompts = await dependencyChoices(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: "Prompts retrieved", data: { prompts } })
  } catch (error: unknown) {
    console.error("GET Prompt Dependencies Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROMPT_DEPENDENCY_MESSAGES.loadFailed) }, { status: 500 })
  }
}
