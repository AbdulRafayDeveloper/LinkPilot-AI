import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { MeetingSchema } from "@/lib/validation/meeting"
import { MEETING_MESSAGES } from "@/constants/meetings"
import { deleteMeeting, getMeeting, updateMeeting } from "@/services/meetings/meetings"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET: One meeting in full, including its transcript and analysis.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const meeting = await getMeeting((await params).id)
    if (!meeting) return NextResponse.json({ success: false, message: MEETING_MESSAGES.notFound }, { status: 404 })
    return NextResponse.json({ success: true, message: "Meeting retrieved", data: meeting })
  } catch (error: unknown) {
    console.error("GET Meeting Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MEETING_MESSAGES.loadFailed) }, { status: 500 })
  }
}

/**
 * PUT: Saves a new name, a new transcript, or both. A changed transcript marks the analysis out
 * of date, and the page then offers to run it again.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = MeetingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || MEETING_MESSAGES.missingTranscript },
        { status: 400 }
      )
    }

    const meeting = await updateMeeting((await params).id, parsed.data)
    if (!meeting) return NextResponse.json({ success: false, message: MEETING_MESSAGES.notFound }, { status: 404 })
    return NextResponse.json({ success: true, message: MEETING_MESSAGES.updated, data: meeting })
  } catch (error: unknown) {
    console.error("PUT Meeting Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MEETING_MESSAGES.saveFailed) }, { status: 500 })
  }
}

/**
 * DELETE: Removes the meeting and everything read from it, after the page has confirmed.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const removed = await deleteMeeting((await params).id)
    if (!removed) return NextResponse.json({ success: false, message: MEETING_MESSAGES.notFound }, { status: 404 })
    return NextResponse.json({ success: true, message: MEETING_MESSAGES.deleted, data: { deleted: 1 } })
  } catch (error: unknown) {
    console.error("DELETE Meeting Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MEETING_MESSAGES.deleteFailed) }, { status: 500 })
  }
}
