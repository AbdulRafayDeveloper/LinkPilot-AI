import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { CREATED_NAME_MAX_LENGTH, CREATED_PROMPT_MAX_LENGTH, PROMPT_CREATOR_MESSAGES } from "@/constants/promptCreator"
import { updateCreatedPrompt } from "@/services/promptCreator/records"

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
  })
  .refine((body) => body.name !== undefined || body.prompt !== undefined, "Nothing to save")

/**
 * PUT: Saves the user's own name or prompt text over the written one, so the saved prompt
 * always matches what they see on the page.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || PROMPT_CREATOR_MESSAGES.saveFailed },
        { status: 400 }
      )
    }

    const saved = await updateCreatedPrompt((await params).id, parsed.data)
    return NextResponse.json({ success: true, message: "Saved", data: saved })
  } catch (error: unknown) {
    console.error("PUT Created Prompt Exception:", error instanceof Error ? error.message : error)
    const message = toUserFacingMessage(error, PROMPT_CREATOR_MESSAGES.saveFailed)
    const isMissing = message === PROMPT_CREATOR_MESSAGES.notFound
    return NextResponse.json({ success: false, message }, { status: isMissing ? 404 : 500 })
  }
}
