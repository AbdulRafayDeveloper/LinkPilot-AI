import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { getFollowUpPrompts } from "@/services/followUp/prompts"
import { requirePromptAccess } from "@/services/promptAccess"

export const dynamic = "force-dynamic"

/**
 * GET: Returns the latest saved prompt (or default) for every follow-up type.
 */
export async function GET() {
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const prompts = await getFollowUpPrompts()
    return NextResponse.json({ success: true, message: "Follow-up prompts retrieved", data: prompts })
  } catch (error: unknown) {
    console.error("GET Follow-Up Prompts Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to load the follow-up prompts") },
      { status: 500 }
    )
  }
}
