import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { MESSAGE_MAX_LENGTH, MESSAGE_REWRITER_MESSAGES } from "@/constants/messageRewriter"
import { rewriteMessage } from "@/services/messageRewriter/generate"
import { recordRewrittenMessage } from "@/services/generationRecords"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest, withSource } from "@/services/modelPriority"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const RewriteSchema = z.object({
  message: z
    .string({ error: MESSAGE_REWRITER_MESSAGES.missingMessage })
    .trim()
    .min(1, MESSAGE_REWRITER_MESSAGES.missingMessage)
    .max(MESSAGE_MAX_LENGTH, MESSAGE_REWRITER_MESSAGES.messageTooLong),
  // Only for the record: whether the message was spoken or typed
  source: z.enum(["text", "voice"]).optional().default("text"),
})

/**
 * POST: Rewrites one message, in any language, into a short and clear English message that
 * says what the user meant, humanized like every other written result, and saves it.
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = RewriteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || MESSAGE_REWRITER_MESSAGES.missingMessage },
        { status: 400 }
      )
    }

    const { message, source } = parsed.data
    const result = withSource(await runAiRequest(auth.viewer, "message-rewriter", () => rewriteMessage({ message, source, signal: req.signal })))
    await recordRewrittenMessage(auth.viewer, { message, source }, result)
    return NextResponse.json({ success: true, message: "Message rewritten", data: result })
  } catch (error: unknown) {
    if (req.signal.aborted) {
      return NextResponse.json({ success: false, message: "Request cancelled" }, { status: 499 })
    }
    console.error("POST Message Rewriter Exception:", error instanceof Error ? error.message : error)
    const message = toUserFacingMessage(error, MESSAGE_REWRITER_MESSAGES.generationFailed)
    // 503 lets the browser retry a provider outage on its own (lib/apiClient.ts)
    const status = message === MESSAGE_REWRITER_MESSAGES.providerUnavailable ? 503 : 500
    return NextResponse.json({ success: false, message }, { status })
  }
}
