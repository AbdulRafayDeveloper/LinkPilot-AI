import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { PROMPT_CREATOR_MESSAGES, REQUEST_MAX_LENGTH } from "@/constants/promptCreator"
import { toSimpleEnglish } from "@/services/promptCreator/english"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest, withSource } from "@/services/modelPriority"

export const dynamic = "force-dynamic"

const EnglishSchema = z.object({
  request: z
    .string({ error: PROMPT_CREATOR_MESSAGES.missingRequest })
    .trim()
    .min(1, PROMPT_CREATOR_MESSAGES.missingRequest)
    .max(REQUEST_MAX_LENGTH, PROMPT_CREATOR_MESSAGES.requestTooLong),
})

/**
 * POST: reads the description back in clear, simple English, for the user to check and keep.
 *
 * It **stores nothing**: the English version is saved only when the prompt itself is created, on
 * that record. So a repeat costs another model call and nothing else, and the browser may safely
 * send it again (`{ retry: true }`).
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = EnglishSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || PROMPT_CREATOR_MESSAGES.missingRequest }, { status: 400 })
  }

  try {
    // The module's own provider order, and counted with its other calls
    const english = withSource(await runAiRequest(auth.viewer, "prompt-creator", () => toSimpleEnglish(parsed.data.request, req.signal)))
    return NextResponse.json({ success: true, message: "Read in English", data: english })
  } catch (error: unknown) {
    if (req.signal.aborted) return NextResponse.json({ success: false, message: "Request cancelled" }, { status: 499 })
    if (error instanceof UserFacingError) return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    console.error("POST Prompt Creator English Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROMPT_CREATOR_MESSAGES.englishFailed) }, { status: 500 })
  }
}
