import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { MEETING_PLANNER_MESSAGES } from "@/constants/meetingPlanner"
import { ProjectsToShowSchema } from "@/lib/validation/meetingScript"
import { saveProjectsToShow } from "@/services/meetingPlanner/plans"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * PUT: saves the projects to show in this meeting, in order, with their optional links. The page
 * sends the whole list after every change, so saving it twice gives the same result.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = ProjectsToShowSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || MEETING_PLANNER_MESSAGES.projectsSaveFailed },
        { status: 400 }
      )
    }

    const result = await saveProjectsToShow(auth.viewer, (await params).id, parsed.data.projects)
    switch (result.outcome) {
      case "saved":
        return NextResponse.json({ success: true, message: MEETING_PLANNER_MESSAGES.projectsSaved, data: result.meeting })
      case "not-found":
        return NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.notFound }, { status: 404 })
      case "no-prep":
        return NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.conversationNoPrep }, { status: 409 })
      case "busy":
        return NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.conversationBusy }, { status: 409 })
    }
  } catch (error: unknown) {
    console.error("PUT Meeting Projects Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, MEETING_PLANNER_MESSAGES.projectsSaveFailed) },
      { status: 500 }
    )
  }
}
