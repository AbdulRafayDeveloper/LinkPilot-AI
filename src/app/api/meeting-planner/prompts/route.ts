import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { getMeetingPlannerPrompts } from "@/services/meetingPlanner/prompts"
import { requirePromptAccess } from "@/services/promptAccess"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: the latest saved preparation prompt (or its default).
 */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const prompts = await getMeetingPlannerPrompts()
    return NextResponse.json({ success: true, message: "Meeting planner prompts retrieved", data: prompts })
  } catch (error: unknown) {
    console.error("GET Meeting Planner Prompts Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to load the meeting preparation prompt") },
      { status: 500 }
    )
  }
}
