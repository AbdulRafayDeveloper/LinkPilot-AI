import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { getMeetingPrompts } from "@/services/meetings/prompts"
import { requirePromptAccess } from "@/services/promptAccess"

export const dynamic = "force-dynamic"

/**
 * GET: The latest saved prompt (or default) for both meeting analysis stages.
 */
export async function GET() {
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const prompts = await getMeetingPrompts()
    return NextResponse.json({ success: true, message: "Meeting prompts retrieved", data: prompts })
  } catch (error: unknown) {
    console.error("GET Meeting Prompts Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to load the meeting prompts") },
      { status: 500 }
    )
  }
}
