import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { PROMPT_CREATOR_MESSAGES, PROMPT_TARGET_IDS, REQUEST_MAX_LENGTH } from "@/constants/promptCreator"
import { createPrompt } from "@/services/promptCreator/generate"
import { saveCreatedPrompt } from "@/services/promptCreator/records"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest, withSource } from "@/services/modelPriority"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const GenerateSchema = z.object({
  request: z
    .string({ error: PROMPT_CREATOR_MESSAGES.missingRequest })
    .trim()
    .min(1, PROMPT_CREATOR_MESSAGES.missingRequest)
    .max(REQUEST_MAX_LENGTH, PROMPT_CREATOR_MESSAGES.requestTooLong),
  target: z.enum(PROMPT_TARGET_IDS, { error: PROMPT_CREATOR_MESSAGES.missingTarget }),
  // Only for the record: whether the description was spoken or typed
  requestSource: z.enum(["text", "voice"]).optional().default("text"),
})

/**
 * POST: Writes one ready-to-paste prompt from the described task, using the latest saved
 * prompt for the chosen target, and saves it with its auto-written name.
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = GenerateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || PROMPT_CREATOR_MESSAGES.missingRequest },
        { status: 400 }
      )
    }

    const { request, target, requestSource } = parsed.data
    const created = withSource(await runAiRequest(auth.viewer, "prompt-creator", () => createPrompt({ request, target, requestSource, signal: req.signal })))
    const saved = await saveCreatedPrompt(auth.viewer, created, { text: request, source: requestSource })
    return NextResponse.json({ success: true, message: "Prompt created", data: saved })
  } catch (error: unknown) {
    if (req.signal.aborted) {
      return NextResponse.json({ success: false, message: "Request cancelled" }, { status: 499 })
    }
    console.error("POST Prompt Creator Generate Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, PROMPT_CREATOR_MESSAGES.generationFailed) },
      { status: 500 }
    )
  }
}
