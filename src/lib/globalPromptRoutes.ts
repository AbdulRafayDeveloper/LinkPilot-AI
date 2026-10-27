import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PromptUpdateSchema } from "@/lib/validation/prompt"
import { getGlobalPromptLabel, type GlobalPromptId } from "@/constants/globalPrompts"
import { getGlobalPrompts, saveGlobalPrompt } from "@/services/globalPrompts"

/**
 * What both Global AI Prompts routes do, each over its own list: every account's prompts at
 * /api/global-prompts, the admin's own at /api/admin/global-prompts. Profile Info is read and saved
 * for the account asking, since it is each person's own (services/profileInfo.ts). A prompt outside the route's
 * list is unknown there, so a prompt only an admin may change can never be read or saved through
 * the route every account may call. Each route checks who is asking before it calls these.
 */

export async function respondWithGlobalPrompts(accountId: string, ids: readonly GlobalPromptId[]): Promise<NextResponse> {
  try {
    return NextResponse.json({ success: true, message: "Global prompts retrieved", data: await getGlobalPrompts(accountId, ids) })
  } catch (error: unknown) {
    console.error("GET Global Prompts Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, "Failed to load the global prompts") }, { status: 500 })
  }
}

export async function saveGlobalPromptFrom(req: NextRequest, accountId: string, id: string, ids: readonly GlobalPromptId[]): Promise<NextResponse> {
  const known = ids.find((entry) => entry === id)
  if (!known) return NextResponse.json({ success: false, message: "Unknown global prompt" }, { status: 404 })
  const parsed = PromptUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || "Invalid prompt" }, { status: 400 })
  }
  try {
    const saved = await saveGlobalPrompt(accountId, known, parsed.data.prompt)
    return NextResponse.json({ success: true, message: `${getGlobalPromptLabel(known)} saved.`, data: saved })
  } catch (error: unknown) {
    console.error("PUT Global Prompt Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, "Failed to save the prompt") }, { status: 500 })
  }
}
