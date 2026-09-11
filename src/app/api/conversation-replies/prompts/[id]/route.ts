import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { PromptUpdateSchema } from "@/lib/validation/prompt"
import { ABOUT_ME_TAB_ID, CONVERSATION_REPLY_PROMPT_IDS, getReplyTypeLabel } from "@/constants/conversationReply"
import { saveConversationReplyPrompt } from "@/services/conversationReply/prompts"
import { requirePromptAccess } from "@/services/promptAccess"

export const dynamic = "force-dynamic"

const PromptIdSchema = z.enum(CONVERSATION_REPLY_PROMPT_IDS)

/**
 * PUT: Saves one reply type's prompt, or the shared About Me. Nothing else changes.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const id = PromptIdSchema.safeParse((await params).id)
    if (!id.success) {
      return NextResponse.json({ success: false, message: "Unknown conversation reply prompt" }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    const parsed = PromptUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Invalid prompt" },
        { status: 400 }
      )
    }

    const saved = await saveConversationReplyPrompt(id.data, parsed.data.prompt)
    const message =
      id.data === ABOUT_ME_TAB_ID
        ? "About Me saved. Every reply type and the analysis will use it."
        : `${getReplyTypeLabel(id.data)} prompt saved. Future ${getReplyTypeLabel(id.data)} replies will use it.`
    return NextResponse.json({ success: true, message, data: saved })
  } catch (error: unknown) {
    console.error("PUT Conversation Reply Prompt Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to save the prompt") },
      { status: 500 }
    )
  }
}
