import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { CREATED_NAME_MAX_LENGTH, CREATED_PROMPT_MAX_LENGTH, PROMPT_CREATOR_MESSAGES } from "@/constants/promptCreator"
import { PROMPT_FOLDER_MESSAGES } from "@/constants/promptFolders"
import { FolderIdSchema } from "@/lib/validation/promptFolders"
import { DependencyIdsSchema } from "@/lib/validation/promptDependencies"
import { updateCreatedPrompt } from "@/services/promptCreator/records"
import { folderForMove } from "@/services/promptCreator/folders"
import { BlockedByDependencies } from "@/services/promptCreator/dependencies"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

const UpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, PROMPT_CREATOR_MESSAGES.missingName)
      .max(CREATED_NAME_MAX_LENGTH, PROMPT_CREATOR_MESSAGES.nameTooLong)
      .optional(),
    prompt: z
      .string()
      .trim()
      .min(1, PROMPT_CREATOR_MESSAGES.emptyPrompt)
      .max(CREATED_PROMPT_MAX_LENGTH, "That prompt is too long to save.")
      .optional(),
    // Which folder it is filed in: an id, or null for no folder
    folderId: FolderIdSchema.optional(),
    // Whether the user has used this prompt; true records when, false takes the mark off
    applied: z.boolean().optional(),
    // The prompts this one waits for; an empty list makes it independent again
    dependencyIds: DependencyIdsSchema.optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.prompt !== undefined ||
      body.folderId !== undefined ||
      body.applied !== undefined ||
      body.dependencyIds !== undefined,
    "Nothing to save"
  )

/**
 * PUT: Saves the user's own name or prompt text over the written one, so the saved prompt always
 * matches what they see on the page, files it in a folder (or takes it out of one), says which
 * prompts it waits for, and marks it as one they have used (or takes that mark off). A folder the
 * viewer may not use is refused; none of moving, waiting or marking counts as edited by hand.
 *
 * **Marking a prompt as used is how it is run**, so a prompt that still waits for prompts that have
 * not run is refused with 409 and a message naming them.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || PROMPT_CREATOR_MESSAGES.saveFailed },
        { status: 400 }
      )
    }

    const { folderId, ...rest } = parsed.data
    const changes = folderId === undefined ? rest : { ...rest, folderId: await folderForMove(auth.viewer, folderId) }
    const saved = await updateCreatedPrompt(auth.viewer, (await params).id, changes)
    return NextResponse.json({ success: true, message: "Saved", data: saved })
  } catch (error: unknown) {
    console.error("PUT Created Prompt Exception:", error instanceof Error ? error.message : error)
    const message = toUserFacingMessage(error, PROMPT_CREATOR_MESSAGES.saveFailed)
    // A folder the viewer may not use reads as not found, the same as a prompt that isn't theirs
    const isMissing = message === PROMPT_CREATOR_MESSAGES.notFound || message === PROMPT_FOLDER_MESSAGES.notFound
    // A prompt asked to run before what it waits for is a conflict with the state, not a server fault
    const status = error instanceof BlockedByDependencies ? 409 : isMissing ? 404 : 500
    return NextResponse.json({ success: false, message }, { status })
  }
}
