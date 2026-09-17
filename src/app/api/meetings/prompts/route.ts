import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { getMeetingPrompts } from "@/services/meetings/prompts"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: The latest saved prompt (or default) for both meeting analysis stages.
 */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
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
