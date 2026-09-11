import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { getFirstMessagePrompts } from "@/services/firstMessage/prompts"
import { requirePromptAccess } from "@/services/promptAccess"

export const dynamic = "force-dynamic"

/**
 * GET: Returns the latest saved prompt (or default) for every tune, plus the shared sender profile.
 */
export async function GET() {
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const prompts = await getFirstMessagePrompts()
    return NextResponse.json({ success: true, message: "First message prompts retrieved", data: prompts })
  } catch (error: unknown) {
    console.error("GET First Message Prompts Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to load the first message prompts") },
      { status: 500 }
    )
  }
}
