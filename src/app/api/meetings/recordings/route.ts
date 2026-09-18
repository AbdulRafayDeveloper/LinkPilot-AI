import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { CreateRecordingSchema } from "@/lib/validation/meetingRecording"
import { RECORDING_MESSAGES } from "@/constants/meetingRecording"
import { createRecordedMeeting } from "@/services/meetings/recording"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

/**
 * POST: Saves the meeting a recording goes into, before anything is recorded, so every chunk the
 * browser uploads has a meeting to belong to. Answers 503 when file storage isn't set up.
 */
async function handlePost(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = CreateRecordingSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || RECORDING_MESSAGES.startFailed }, { status: 400 })
  }
  try {
    const created = await createRecordedMeeting(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: "Recording started", data: created }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof UserFacingError && error.message === RECORDING_MESSAGES.storageUnavailable) {
      return NextResponse.json({ success: false, message: error.message }, { status: 503 })
    }
    console.error("POST Meeting Recording Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, RECORDING_MESSAGES.startFailed) }, { status: 500 })
  }
}

// A repeat of the same start (same Idempotency-Key) gets the same meeting back rather than a second one
export const POST = withIdempotency("meetings:recordings", handlePost)
