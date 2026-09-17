import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PromptUpdateSchema } from "@/lib/validation/prompt"
import { getClientMessagePrompt, saveClientMessagePrompt } from "@/services/clientMessaging/prompts"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: The prompt every client message is written with, plus its default.
 */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const prompt = await getClientMessagePrompt()
    return NextResponse.json({ success: true, message: "Client message prompt retrieved", data: prompt })
  } catch (error: unknown) {
    console.error("GET Client Message Prompt Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to load the client message prompt") },
      { status: 500 }
    )
  }
}

/**
 * PUT: Saves the prompt. The next message written uses it, for every client and channel.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = PromptUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Invalid prompt" },
        { status: 400 }
      )
    }

    const saved = await saveClientMessagePrompt(parsed.data.prompt)
    return NextResponse.json({ success: true, message: "Prompt saved. Your next message will use it.", data: saved })
  } catch (error: unknown) {
    console.error("PUT Client Message Prompt Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to save the prompt") },
      { status: 500 }
    )
  }
}
