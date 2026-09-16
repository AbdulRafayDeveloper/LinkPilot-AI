import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { PromptUpdateSchema } from "@/lib/validation/prompt"
import { PROMPT_TARGET_IDS, getPromptTargetLabel } from "@/constants/promptCreator"
import { saveTargetPrompt } from "@/services/promptCreator/prompts"
import { requirePromptAccess } from "@/services/promptAccess"

export const dynamic = "force-dynamic"

const TargetSchema = z.enum(PROMPT_TARGET_IDS)

/**
 * PUT: Saves the prompt for one target only. The other target's prompt is untouched.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ target: string }> }) {
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const target = TargetSchema.safeParse((await params).target)
    if (!target.success) {
      return NextResponse.json({ success: false, message: "Unknown prompt target" }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    const parsed = PromptUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Invalid prompt" },
        { status: 400 }
      )
    }

    const saved = await saveTargetPrompt(target.data, parsed.data.prompt)
    const label = getPromptTargetLabel(target.data)
    return NextResponse.json({
      success: true,
      message: `${label} prompt saved. Prompts you create for it will use this.`,
      data: saved,
    })
  } catch (error: unknown) {
    console.error("PUT Prompt Creator Prompt Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to save the prompt") },
      { status: 500 }
    )
  }
}
