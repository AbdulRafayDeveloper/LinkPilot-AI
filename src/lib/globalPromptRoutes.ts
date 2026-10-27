import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PromptUpdateSchema } from "@/lib/validation/prompt"
import { getGlobalPromptLabel, PROFILE_INFO_ID, type GlobalPromptId } from "@/constants/globalPrompts"
import { getGlobalPrompts, saveGlobalPrompt } from "@/services/globalPrompts"
import { runAiRequest } from "@/services/modelPriority"
import { indexProfileInfo } from "@/services/myProfile/vectors"
import type { Viewer } from "@/types/auth"

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

/**
 * Saves one prompt for the account asking. Profile Info is then saved for search as well (Gemini
 * vectors, services/myProfile/vectors.ts), once the text itself is safely kept: that step never fails
 * the save, and one that could not run is tried again the next time My AI Profile opens.
 */
export async function saveGlobalPromptFrom(req: NextRequest, viewer: Viewer, id: string, ids: readonly GlobalPromptId[]): Promise<NextResponse> {
  const known = ids.find((entry) => entry === id)
  if (!known) return NextResponse.json({ success: false, message: "Unknown global prompt" }, { status: 404 })
  const parsed = PromptUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || "Invalid prompt" }, { status: 400 })
  }
  try {
    const saved = await saveGlobalPrompt(viewer.id, known, parsed.data.prompt)
    if (known === PROFILE_INFO_ID) await runAiRequest(viewer, "global-prompts", () => indexProfileInfo(viewer.id, saved.prompt, req.signal))
    return NextResponse.json({ success: true, message: `${getGlobalPromptLabel(known)} saved.`, data: saved })
  } catch (error: unknown) {
    console.error("PUT Global Prompt Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, "Failed to save the prompt") }, { status: 500 })
  }
}
