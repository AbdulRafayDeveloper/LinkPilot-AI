import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { MEETING_PLANNER_MESSAGES } from "@/constants/meetingPlanner"
import { ConversationScriptSchema } from "@/lib/validation/meetingScript"
import { saveConversation } from "@/services/meetingPlanner/plans"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * PUT: saves the conversation script as the user edited it (stages and steps, in order). Nothing
 * is generated; the rest of the preparation is left as it was written. Saving the same script
 * twice gives the same result, so a retry is always safe.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = ConversationScriptSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || MEETING_PLANNER_MESSAGES.conversationInvalid },
        { status: 400 }
      )
    }

    const result = await saveConversation(auth.viewer, (await params).id, parsed.data.stages)
    switch (result.outcome) {
      case "saved":
        return NextResponse.json({ success: true, message: MEETING_PLANNER_MESSAGES.conversationSaved, data: result.meeting })
      case "not-found":
        return NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.notFound }, { status: 404 })
      case "no-prep":
        return NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.conversationNoPrep }, { status: 409 })
      case "busy":
        return NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.conversationBusy }, { status: 409 })
    }
  } catch (error: unknown) {
    console.error("PUT Meeting Conversation Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, MEETING_PLANNER_MESSAGES.conversationSaveFailed) },
      { status: 500 }
    )
  }
}
