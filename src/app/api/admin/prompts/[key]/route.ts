import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { PromptUpdateSchema } from "@/lib/validation/prompt"
import { ADMIN_PROMPT_MESSAGES } from "@/constants/adminPrompts"
import { saveAdminPrompt } from "@/services/admin/prompts"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * PUT { prompt }: Admin only. Saves one stored prompt, system prompts included. The next result
 * anyone writes uses it, since prompts are read fresh on every generation.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const parsed = PromptUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || ADMIN_PROMPT_MESSAGES.saveFailed }, { status: 400 })
  }
  try {
    const saved = await saveAdminPrompt((await params).key, parsed.data.prompt)
    return NextResponse.json({ success: true, message: ADMIN_PROMPT_MESSAGES.saved, data: saved })
  } catch (error: unknown) {
    if (error instanceof UserFacingError && error.message === ADMIN_PROMPT_MESSAGES.unknownPrompt) {
      return NextResponse.json({ success: false, message: error.message }, { status: 404 })
    }
    console.error("PUT Admin Prompt Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, ADMIN_PROMPT_MESSAGES.saveFailed) }, { status: 500 })
  }
}
