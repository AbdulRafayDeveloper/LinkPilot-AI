import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { MeetingSchema } from "@/lib/validation/meeting"
import { MEETING_MESSAGES, MEETING_SEARCH_MAX_LENGTH, MEETING_STATUS_IDS } from "@/constants/meetings"
import { createMeeting, listMeetings } from "@/services/meetings/meetings"

export const dynamic = "force-dynamic"

const StatusSchema = z.enum(MEETING_STATUS_IDS).nullable().catch(null)

/**
 * GET (?search=&status=&cursor=): One page of the meeting history, newest first. Transcripts are
 * never part of this answer, however large the history grows.
 */
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const page = await listMeetings({
      search: (params.get("search") ?? "").slice(0, MEETING_SEARCH_MAX_LENGTH),
      status: StatusSchema.parse(params.get("status")),
      cursor: params.get("cursor"),
    })
    return NextResponse.json({ success: true, message: "Meetings retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Meetings Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MEETING_MESSAGES.loadFailed) }, { status: 500 })
  }
}

/**
 * POST: Saves the meeting and answers at once. Nothing is analyzed here: the page starts the
 * analysis with its own calls, so a five hour transcript never rides on one request.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = MeetingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || MEETING_MESSAGES.missingTranscript },
        { status: 400 }
      )
    }

    const meeting = await createMeeting(parsed.data)
    return NextResponse.json({ success: true, message: MEETING_MESSAGES.saved, data: meeting }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Meeting Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MEETING_MESSAGES.saveFailed) }, { status: 500 })
  }
}
