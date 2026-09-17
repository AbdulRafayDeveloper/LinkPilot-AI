import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import {
  CONVERSATION_MAX_LENGTH,
  FOLLOW_UP_MESSAGES,
  FOLLOW_UP_PROFILE_MAX_LENGTH,
  FOLLOW_UP_TYPE_IDS,
} from "@/constants/followUp"
import { generateFollowUp } from "@/services/followUp/generate"
import { recordFollowUp } from "@/services/generationRecords"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest, withSource } from "@/services/modelPriority"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const GenerateSchema = z.object({
  conversation: z
    .string({ error: FOLLOW_UP_MESSAGES.missingConversation })
    .trim()
    .min(1, FOLLOW_UP_MESSAGES.missingConversation)
    .max(CONVERSATION_MAX_LENGTH, FOLLOW_UP_MESSAGES.conversationTooLong),
  // Optional: blank profile text is treated the same as no profile
  profileData: z
    .string()
    .trim()
    .max(FOLLOW_UP_PROFILE_MAX_LENGTH, FOLLOW_UP_MESSAGES.profileTooLong)
    .optional()
    .transform((value) => value || null),
  followUpType: z.enum(FOLLOW_UP_TYPE_IDS, { error: FOLLOW_UP_MESSAGES.missingType }),
})

/**
 * POST: Generates one follow-up from the pasted conversation (plus optional profile)
 * using the latest saved prompt for the selected type (the module's provider order, Groq first).
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = GenerateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || FOLLOW_UP_MESSAGES.missingConversation },
        { status: 400 }
      )
    }

    const { conversation, profileData, followUpType } = parsed.data
    const result = withSource(await runAiRequest(auth.viewer, "follow-up-message", () => generateFollowUp({ conversation, profileData, type: followUpType, signal: req.signal })))
    await recordFollowUp(auth.viewer, { conversation, profileData }, result)
    return NextResponse.json({ success: true, message: "Follow-up message generated", data: result })
  } catch (error: unknown) {
    if (req.signal.aborted) {
      return NextResponse.json({ success: false, message: "Request cancelled" }, { status: 499 })
    }
    console.error("POST Follow-Up Generate Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, FOLLOW_UP_MESSAGES.generationFailed) },
      { status: 500 }
    )
  }
}
