import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { getInMailPrompts } from "@/services/inmail/prompts"
import { requirePromptAccess } from "@/services/promptAccess"

export const dynamic = "force-dynamic"

/**
 * GET: Returns the latest saved prompt (or default) for every InMail tune, plus the shared sender profile.
 */
export async function GET() {
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const prompts = await getInMailPrompts()
    return NextResponse.json({ success: true, message: "InMail prompts retrieved", data: prompts })
  } catch (error: unknown) {
    console.error("GET InMail Prompts Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to load the InMail prompts") },
      { status: 500 }
    )
  }
}
