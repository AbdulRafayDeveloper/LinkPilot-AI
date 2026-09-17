import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { PromptUpdateSchema } from "@/lib/validation/prompt"
import { GLOBAL_PROMPT_IDS, getGlobalPromptLabel } from "@/constants/globalPrompts"
import { saveGlobalPrompt } from "@/services/globalPrompts"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

const GlobalPromptIdSchema = z.enum(GLOBAL_PROMPT_IDS)

/**
 * PUT: Saves one global prompt only. The other global prompts are untouched.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const id = GlobalPromptIdSchema.safeParse((await params).id)
    if (!id.success) {
      return NextResponse.json({ success: false, message: "Unknown global prompt" }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    const parsed = PromptUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Invalid prompt" },
        { status: 400 }
      )
    }

    const saved = await saveGlobalPrompt(id.data, parsed.data.prompt)
    return NextResponse.json({ success: true, message: `${getGlobalPromptLabel(id.data)} saved.`, data: saved })
  } catch (error: unknown) {
    console.error("PUT Global Prompt Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to save the prompt") },
      { status: 500 }
    )
  }
}
