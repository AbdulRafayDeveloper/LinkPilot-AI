import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PromptUpdateSchema } from "@/lib/validation/prompt"
import { getClientVoicesPrompt, saveClientVoicesPrompt } from "@/services/clientVoices/prompts"
import { requirePromptAccess } from "@/services/promptAccess"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: The prompt the task list is written with, plus its default.
 */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const prompt = await getClientVoicesPrompt()
    return NextResponse.json({ success: true, message: "Client voices prompt retrieved", data: prompt })
  } catch (error: unknown) {
    console.error("GET Client Voices Prompt Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to load the client voices prompt") },
      { status: 500 }
    )
  }
}

/**
 * PUT: Saves the prompt. The next batch uses it.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
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

    const saved = await saveClientVoicesPrompt(parsed.data.prompt)
    return NextResponse.json({ success: true, message: "Prompt saved. Your next batch will use it.", data: saved })
  } catch (error: unknown) {
    console.error("PUT Client Voices Prompt Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to save the prompt") },
      { status: 500 }
    )
  }
}
