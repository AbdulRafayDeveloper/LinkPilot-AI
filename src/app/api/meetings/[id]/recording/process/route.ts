import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { RECORDING_MESSAGES } from "@/constants/meetingRecording"
import { MEETING_MESSAGES } from "@/constants/meetings"
import { runRecordingStep } from "@/services/meetings/recording"
import { getMeeting } from "@/services/meetings/meetings"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest } from "@/services/modelPriority"

export const dynamic = "force-dynamic"
// One step stops starting new work after RECORDING_STEP_BUDGET_MS, so it fits a Hobby function's 60 seconds
export const maxDuration = 60

/**
 * POST: Moves a recording forward by one short step (joining its chunks, then writing out its audio)
 * and answers how far it got. The page calls again while `hasMore` is true. Writing out is Whisper on
 * Groq only: OpenAI is left out of this request's providers altogether.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const { id } = await params
  try {
    if (!(await getMeeting(auth.viewer, id))) return NextResponse.json({ success: false, message: MEETING_MESSAGES.notFound }, { status: 404 })
    const { result } = await runAiRequest(auth.viewer, "meetings", () => runRecordingStep(id, req.signal), { without: ["openai"] })
    if (!result) return NextResponse.json({ success: false, message: MEETING_MESSAGES.notFound }, { status: 404 })
    return NextResponse.json({ success: true, message: "Recording moved on", data: result })
  } catch (error: unknown) {
    if (req.signal.aborted) return NextResponse.json({ success: false, message: "Request cancelled" }, { status: 499 })
    console.error("POST Recording Process Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, RECORDING_MESSAGES.processFailed) }, { status: 500 })
  }
}
