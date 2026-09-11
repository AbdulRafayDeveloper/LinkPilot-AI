import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { PromptUpdateSchema } from "@/lib/validation/prompt"
import { ABOUT_ME_TAB_ID, getOutreachTuneLabel } from "@/constants/outreachTunes"
import { INMAIL_PROMPT_IDS } from "@/constants/inmail"
import { saveInMailPrompt } from "@/services/inmail/prompts"
import { requirePromptAccess } from "@/services/promptAccess"

export const dynamic = "force-dynamic"

const PromptIdSchema = z.enum(INMAIL_PROMPT_IDS)

/**
 * PUT: Saves one InMail tune's prompt, or the shared sender profile. Nothing else changes.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const id = PromptIdSchema.safeParse((await params).id)
    if (!id.success) {
      return NextResponse.json({ success: false, message: "Unknown InMail prompt" }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    const parsed = PromptUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Invalid prompt" },
        { status: 400 }
      )
    }

    const saved = await saveInMailPrompt(id.data, parsed.data.prompt)
    const message =
      id.data === ABOUT_ME_TAB_ID
        ? "About Me saved. Every tune in First Message and InMail will use it."
        : `${getOutreachTuneLabel(id.data)} InMail prompt saved. Future ${getOutreachTuneLabel(id.data)} InMails will use it.`
    return NextResponse.json({ success: true, message, data: saved })
  } catch (error: unknown) {
    console.error("PUT InMail Prompt Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to save the prompt") },
      { status: 500 }
    )
  }
}
