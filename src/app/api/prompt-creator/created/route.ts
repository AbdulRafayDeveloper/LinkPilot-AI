import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PROMPT_CREATOR_MESSAGES } from "@/constants/promptCreator"
import { PROMPT_DEPENDENCY_MESSAGES } from "@/constants/promptDependencies"
import { PROMPT_FOLDER_MESSAGES } from "@/constants/promptFolders"
import { DependencyChoicesQuerySchema } from "@/lib/validation/promptDependencies"
import { AddCreatedPromptSchema } from "@/lib/validation/promptCreator"
import { dependencyChoices } from "@/services/promptCreator/dependencies"
import { addCreatedPrompt } from "@/services/promptCreator/records"
import { folderForMove } from "@/services/promptCreator/folders"
import { withIdempotency } from "@/services/idempotency"
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

/**
 * POST (body: { name, prompt, target?, folderId?, dependencyIds? }): Saves a prompt the user
 * **already had**, rather than one this module wrote. It is the same record, so the prompt is filed,
 * told what it waits for, marked as applied, searched and deleted exactly like a written one; what
 * it says about itself is that it was added by hand and has no description and no provider.
 *
 * A folder that is not the viewer's own, and a prompt told to wait for one that is not, are both
 * refused before anything is saved. It creates a record, so it goes through `withIdempotency`.
 */
async function handlePost(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = AddCreatedPromptSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || PROMPT_CREATOR_MESSAGES.addFailed }, { status: 400 })
  }

  try {
    const { folderId, ...added } = parsed.data
    const prompt = await addCreatedPrompt(auth.viewer, { ...added, folderId: await folderForMove(auth.viewer, folderId) })
    return NextResponse.json({ success: true, message: `"${prompt.name}" added.`, data: prompt }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Created Prompt Exception:", error instanceof Error ? error.message : error)
    const message = toUserFacingMessage(error, PROMPT_CREATOR_MESSAGES.addFailed)
    // A folder or a dependency that is not the viewer's is the request's fault, not the server's
    const isTheirs = message !== PROMPT_FOLDER_MESSAGES.notFound && message !== PROMPT_DEPENDENCY_MESSAGES.missing
    return NextResponse.json({ success: false, message }, { status: isTheirs ? 500 : 400 })
  }
}

export const POST = withIdempotency("prompt-creator:created", handlePost)
