import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { MEETING_PLANNER_MESSAGES } from "@/constants/meetingPlanner"
import { MEETING_PLAN_LINK_MESSAGES } from "@/constants/meetings"
import { meetingsOfPlan } from "@/services/meetings/planLink"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: the notes and recordings linked to one planned meeting, newest first — what the popup on the
 * calendar lists, with enough of each to name it and open it.
 *
 * The planned meeting is read through the viewer's own scope, so one that is gone or another
 * account's answers 404 rather than an empty list, and the records are scoped the same way.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const meetings = await meetingsOfPlan(auth.viewer, (await params).id)
    if (!meetings) {
      return NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.notFound }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: "Linked meetings retrieved", data: { meetings } })
  } catch (error: unknown) {
    console.error("GET Plan Meetings Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, MEETING_PLAN_LINK_MESSAGES.linkFailed) },
      { status: 500 }
    )
  }
}
