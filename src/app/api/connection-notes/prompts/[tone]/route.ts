import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { PromptUpdateSchema } from "@/lib/validation/prompt"
import { CONNECTION_NOTE_TONE_IDS, getToneLabel } from "@/constants/connectionNote"
import { saveTonePrompt } from "@/services/connectionNote/prompts"
import { requirePromptAccess } from "@/services/promptAccess"

export const dynamic = "force-dynamic"

const ToneSchema = z.enum(CONNECTION_NOTE_TONE_IDS)

/**
 * PUT: Saves the prompt for one tone only. Other tones' prompts are untouched.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ tone: string }> }) {
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const tone = ToneSchema.safeParse((await params).tone)
    if (!tone.success) {
      return NextResponse.json({ success: false, message: "Unknown connection note tone" }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    const parsed = PromptUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Invalid prompt" },
        { status: 400 }
      )
    }

    const saved = await saveTonePrompt(tone.data, parsed.data.prompt)
    const label = getToneLabel(tone.data)
    return NextResponse.json({
      success: true,
      message: `${label} prompt saved. Future ${label} notes will use it.`,
      data: saved,
    })
  } catch (error: unknown) {
    console.error("PUT Connection Note Prompt Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to save the prompt") },
      { status: 500 }
    )
  }
}
