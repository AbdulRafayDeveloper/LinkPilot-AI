import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { FinishRecordingSchema } from "@/lib/validation/meetingRecording"
import { RECORDING_MESSAGES } from "@/constants/meetingRecording"
import { MEETING_MESSAGES } from "@/constants/meetings"
import { finishRecording } from "@/services/meetings/recording"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * POST: Ends the recording and starts joining and writing it out. Every chunk the browser counted must
 * already be confirmed, or it answers 409 so the page waits for the rest; `{ partial: true }` finishes a
 * recording whose page closed with what arrived. Finishing twice answers with where it is.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = FinishRecordingSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || RECORDING_MESSAGES.processFailed }, { status: 400 })
  try {
    const recording = await finishRecording(auth.viewer, (await params).id, parsed.data)
    if (!recording) return NextResponse.json({ success: false, message: MEETING_MESSAGES.notFound }, { status: 404 })
    return NextResponse.json({ success: true, message: "Recording finished", data: recording })
  } catch (error: unknown) {
    if (error instanceof UserFacingError && error.message === RECORDING_MESSAGES.stillUploading) {
      return NextResponse.json({ success: false, message: error.message }, { status: 409 })
    }
    console.error("POST Recording Finish Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, RECORDING_MESSAGES.processFailed) }, { status: 500 })
  }
}
