import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { PromptUpdateSchema } from "@/lib/validation/prompt"
import { FOLLOW_UP_TYPE_IDS, getFollowUpTypeLabel } from "@/constants/followUp"
import { saveFollowUpPrompt } from "@/services/followUp/prompts"
import { requirePromptAccess } from "@/services/promptAccess"

export const dynamic = "force-dynamic"

const TypeSchema = z.enum(FOLLOW_UP_TYPE_IDS)

/**
 * PUT: Saves the prompt for one follow-up type only. The other type's prompt is untouched.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const type = TypeSchema.safeParse((await params).type)
    if (!type.success) {
      return NextResponse.json({ success: false, message: "Unknown follow-up type" }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    const parsed = PromptUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Invalid prompt" },
        { status: 400 }
      )
    }

    const saved = await saveFollowUpPrompt(type.data, parsed.data.prompt)
    const label = getFollowUpTypeLabel(type.data)
    return NextResponse.json({
      success: true,
      message: `${label} prompt saved. Future ${label} messages will use it.`,
      data: saved,
    })
  } catch (error: unknown) {
    console.error("PUT Follow-Up Prompt Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to save the prompt") },
      { status: 500 }
    )
  }
}
