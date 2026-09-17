import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { PromptUpdateSchema } from "@/lib/validation/prompt"
import { FOLLOW_UP_PROMPT_IDS, getFollowUpPromptLabel } from "@/constants/followUp"
import { saveFollowUpPrompt } from "@/services/followUp/prompts"
import { requirePromptAccess } from "@/services/promptAccess"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

// The segment is a prompt id: a follow-up type, or the Lead Signals prompt
const PromptIdSchema = z.enum(FOLLOW_UP_PROMPT_IDS)

/**
 * PUT: Saves one follow-up prompt only. The other prompts are untouched.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const id = PromptIdSchema.safeParse((await params).type)
    if (!id.success) {
      return NextResponse.json({ success: false, message: "Unknown follow-up prompt" }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    const parsed = PromptUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Invalid prompt" },
        { status: 400 }
      )
    }

    const saved = await saveFollowUpPrompt(id.data, parsed.data.prompt)
    const label = getFollowUpPromptLabel(id.data)
    return NextResponse.json({
      success: true,
      message: `${label} prompt saved. The next follow-up will use it.`,
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
