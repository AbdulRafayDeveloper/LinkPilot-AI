import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import {
  CONVERSATION_REPLY_CONVERSATION_MAX_LENGTH,
  CONVERSATION_REPLY_MESSAGES,
  CONVERSATION_REPLY_PROFILE_MAX_LENGTH,
  CONVERSATION_REPLY_TYPE_IDS,
} from "@/constants/conversationReply"
import { analyzeAndReply } from "@/services/conversationReply"
import { recordConversationReply } from "@/services/generationRecords"
import { requireViewer } from "@/services/auth/viewer"
import { withModelOrder } from "@/lib/modelOrder"
import { modelOrderFor } from "@/services/modelPriority"

export const dynamic = "force-dynamic"
// Analysis and reply run one after the other, each trying the module's providers in order (Groq first)
export const maxDuration = 300

const GenerateSchema = z.object({
  conversation: z
    .string({ error: CONVERSATION_REPLY_MESSAGES.missingConversation })
    .trim()
    .min(1, CONVERSATION_REPLY_MESSAGES.missingConversation)
    .max(CONVERSATION_REPLY_CONVERSATION_MAX_LENGTH, CONVERSATION_REPLY_MESSAGES.conversationTooLong),
  // Optional: blank profile text is treated the same as no profile
  profileData: z
    .string()
    .trim()
    .max(CONVERSATION_REPLY_PROFILE_MAX_LENGTH, CONVERSATION_REPLY_MESSAGES.profileTooLong)
    .optional()
    .transform((value) => value || null),
  replyType: z.enum(CONVERSATION_REPLY_TYPE_IDS, { error: CONVERSATION_REPLY_MESSAGES.missingType }),
})

/**
 * POST: Analyzes the pasted conversation and writes the next reply with the latest saved
 * prompt for the selected reply type (the module's provider order, Groq first).
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = GenerateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || CONVERSATION_REPLY_MESSAGES.missingConversation },
        { status: 400 }
      )
    }

    const result = await withModelOrder(await modelOrderFor(auth.viewer, "conversation-reply"), () => analyzeAndReply({ ...parsed.data, signal: req.signal }))
    await recordConversationReply(auth.viewer, parsed.data, result)
    return NextResponse.json({ success: true, message: "Conversation analyzed and reply generated", data: result })
  } catch (error: unknown) {
    if (req.signal.aborted) {
      return NextResponse.json({ success: false, message: "Request cancelled" }, { status: 499 })
    }
    console.error("POST Conversation Reply Generate Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, CONVERSATION_REPLY_MESSAGES.generationFailed) },
      { status: 500 }
    )
  }
}
