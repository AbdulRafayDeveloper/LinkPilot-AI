import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { PromptUpdateSchema } from "@/lib/validation/prompt"
import { COMMENT_TUNE_IDS, getTuneLabel } from "@/constants/commentWriter"
import { saveTunePrompt } from "@/services/commentWriter/prompts"
import { requirePromptAccess } from "@/services/promptAccess"

export const dynamic = "force-dynamic"

const TuneSchema = z.enum(COMMENT_TUNE_IDS)

/**
 * PUT: Saves the prompt for one tune only. The other tunes' prompts are untouched.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ tune: string }> }) {
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const tune = TuneSchema.safeParse((await params).tune)
    if (!tune.success) {
      return NextResponse.json({ success: false, message: "Unknown comment style" }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    const parsed = PromptUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Invalid prompt" },
        { status: 400 }
      )
    }

    const saved = await saveTunePrompt(tune.data, parsed.data.prompt)
    const label = getTuneLabel(tune.data)
    return NextResponse.json({
      success: true,
      message: `${label} prompt saved. Future ${label} comments will use it.`,
      data: saved,
    })
  } catch (error: unknown) {
    console.error("PUT Comment Writer Prompt Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to save the prompt") },
      { status: 500 }
    )
  }
}
