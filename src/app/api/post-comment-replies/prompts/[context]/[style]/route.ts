import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { PromptUpdateSchema } from "@/lib/validation/prompt"
import {
  REPLY_CONTEXT_IDS,
  REPLY_STYLE_IDS,
  getReplyContextLabel,
  getReplyStyleLabel,
} from "@/constants/postCommentReplies"
import { saveReplyPrompt } from "@/services/postCommentReplies/prompts"

export const dynamic = "force-dynamic"

const ParamsSchema = z.object({
  context: z.enum(REPLY_CONTEXT_IDS),
  style: z.enum(REPLY_STYLE_IDS),
})

/**
 * PUT: Saves the prompt for exactly one context + style pair. The other 13 prompts are untouched.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ context: string; style: string }> }) {
  try {
    const target = ParamsSchema.safeParse(await params)
    if (!target.success) {
      return NextResponse.json({ success: false, message: "Unknown reply context or style" }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    const parsed = PromptUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Invalid prompt" },
        { status: 400 }
      )
    }

    const { context, style } = target.data
    const saved = await saveReplyPrompt(context, style, parsed.data.prompt)
    const label = `${getReplyContextLabel(context)} → ${getReplyStyleLabel(style)}`
    return NextResponse.json({
      success: true,
      message: `${label} prompt saved. Future replies in this style will use it.`,
      data: saved,
    })
  } catch (error: unknown) {
    console.error("PUT Post Comment Reply Prompt Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to save the prompt") },
      { status: 500 }
    )
  }
}
