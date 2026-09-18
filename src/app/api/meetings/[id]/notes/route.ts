import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { MeetingNotesSchema } from "@/lib/validation/meetingRecording"
import { RECORDING_MESSAGES } from "@/constants/meetingRecording"
import { MEETING_MESSAGES } from "@/constants/meetings"
import { saveNotes } from "@/services/meetings/meetings"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * PUT: Saves the user's own wording of a meeting's notes. Once edited, a new analysis leaves them alone;
 * saving them empty lets the next analysis write them again.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = MeetingNotesSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || RECORDING_MESSAGES.notesFailed }, { status: 400 })
  try {
    const meeting = await saveNotes(auth.viewer, (await params).id, parsed.data.notes)
    if (!meeting) return NextResponse.json({ success: false, message: MEETING_MESSAGES.notFound }, { status: 404 })
    return NextResponse.json({ success: true, message: RECORDING_MESSAGES.notesSaved, data: meeting })
  } catch (error: unknown) {
    console.error("PUT Meeting Notes Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, RECORDING_MESSAGES.notesFailed) }, { status: 500 })
  }
}
