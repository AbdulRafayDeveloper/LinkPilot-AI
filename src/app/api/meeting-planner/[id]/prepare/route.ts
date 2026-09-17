import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { MEETING_PLANNER_MESSAGES } from "@/constants/meetingPlanner"
import { claimPrepRun, failPrep, getMeeting, savePrep } from "@/services/meetingPlanner/plans"
import { prepareMeeting } from "@/services/meetingPlanner/prepare"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest, withSource } from "@/services/modelPriority"

export const dynamic = "force-dynamic"
// Reading a profile, a conversation and writing a whole meeting plan takes longer than a message
export const maxDuration = 300

/**
 * POST: writes the preparation for one meeting and saves it with the meeting, so it is written
 * once and read from the database every time after that.
 *
 * The meeting is already saved before this runs, so a provider failure only marks the
 * preparation as failed and the same call can be made again. Running twice at once is refused
 * rather than queued, because nothing here may depend on a server staying alive between requests.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const { id } = await params
  try {
    const meeting = await getMeeting(auth.viewer, id)
    if (!meeting) {
      return NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.notFound }, { status: 404 })
    }
    if (!meeting.prepEnabled) {
      return NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.prepOff }, { status: 400 })
    }

    // Only one run at a time; a second click gets told, not served
    const claimed = await claimPrepRun(id)
    if (!claimed) {
      return NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.prepRunning }, { status: 409 })
    }

    try {
      const prep = withSource(await runAiRequest(auth.viewer, "meeting-planner", () => prepareMeeting(claimed, req.signal)))
      const saved = await savePrep(id, prep)
      if (!saved) {
        return NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.notFound }, { status: 404 })
      }
      return NextResponse.json({ success: true, message: MEETING_PLANNER_MESSAGES.prepReady, data: saved })
    } catch (error: unknown) {
      if (req.signal.aborted) {
        // The user navigated away or the request was cut: leave it ready to run again
        await failPrep(id, "The request stopped before the preparation finished.")
        return NextResponse.json({ success: false, message: "Request cancelled" }, { status: 499 })
      }
      const message = toUserFacingMessage(error, MEETING_PLANNER_MESSAGES.prepFailed)
      console.error("POST Meeting Preparation Exception:", error instanceof Error ? error.message : error)
      await failPrep(id, message)
      return NextResponse.json({ success: false, message }, { status: 502 })
    }
  } catch (error: unknown) {
    console.error("POST Meeting Preparation Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, MEETING_PLANNER_MESSAGES.prepFailed) },
      { status: 500 }
    )
  }
}
