import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PromptUpdateSchema } from "@/lib/validation/prompt"
import { getMessageRewriterPrompt, saveMessageRewriterPrompt } from "@/services/messageRewriter/prompts"
import { requirePromptAccess } from "@/services/promptAccess"

export const dynamic = "force-dynamic"

/**
 * GET: The prompt every message is rewritten with, plus its default.
 */
export async function GET() {
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const prompt = await getMessageRewriterPrompt()
    return NextResponse.json({ success: true, message: "Message rewriter prompt retrieved", data: prompt })
  } catch (error: unknown) {
    console.error("GET Message Rewriter Prompt Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to load the message rewriter prompt") },
      { status: 500 }
    )
  }
}

/**
 * PUT: Saves the prompt. The next message rewritten uses it.
 */
export async function PUT(req: NextRequest) {
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const body = await req.json().catch(() => null)
    const parsed = PromptUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Invalid prompt" },
        { status: 400 }
      )
    }

    const saved = await saveMessageRewriterPrompt(parsed.data.prompt)
    return NextResponse.json({ success: true, message: "Prompt saved. Your next rewrite will use it.", data: saved })
  } catch (error: unknown) {
    console.error("PUT Message Rewriter Prompt Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to save the prompt") },
      { status: 500 }
    )
  }
}
