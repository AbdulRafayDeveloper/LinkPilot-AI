import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { PromptUpdateSchema } from "@/lib/validation/prompt"
import { MEETING_PROMPT_IDS } from "@/constants/meetings"
import { saveMeetingPrompt } from "@/services/meetings/prompts"
import { requirePromptAccess } from "@/services/promptAccess"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

const IdSchema = z.enum(MEETING_PROMPT_IDS)

/**
 * PUT: Saves one of the two meeting prompts. The next meeting analysed uses it, with no code
 * change and no deployment.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const id = IdSchema.safeParse((await params).id)
    if (!id.success) return NextResponse.json({ success: false, message: "Unknown meeting prompt" }, { status: 404 })

    const body = await req.json().catch(() => null)
    const parsed = PromptUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || "Invalid prompt" }, { status: 400 })
    }

    const saved = await saveMeetingPrompt(id.data, parsed.data.prompt)
    return NextResponse.json({ success: true, message: "Prompt saved. The next analysis will use it.", data: saved })
  } catch (error: unknown) {
    console.error("PUT Meeting Prompt Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, "Failed to save the prompt") }, { status: 500 })
  }
}
