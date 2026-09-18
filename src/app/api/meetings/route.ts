import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { MeetingSchema } from "@/lib/validation/meeting"
import { MEETING_MESSAGES, MEETING_SEARCH_MAX_LENGTH, MEETING_STATUS_IDS } from "@/constants/meetings"
import { createMeeting, deleteMeetings, listMeetings } from "@/services/meetings/meetings"
import { BulkDeleteSchema } from "@/lib/validation/listFilters"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

const StatusSchema = z.enum(MEETING_STATUS_IDS).nullable().catch(null)

/**
 * GET (?search=&status=&cursor=): One page of the meeting history, newest first. Transcripts are
 * never part of this answer, however large the history grows.
 */
export async function GET(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const params = req.nextUrl.searchParams
    const page = await listMeetings(auth.viewer, {
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
async function handlePost(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = MeetingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || MEETING_MESSAGES.missingTranscript },
        { status: 400 }
      )
    }

    const meeting = await createMeeting(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: MEETING_MESSAGES.saved, data: meeting }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Meeting Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MEETING_MESSAGES.saveFailed) }, { status: 500 })
  }
}

// A retry of the same request (same Idempotency-Key) gets the first answer back instead of running again
export const POST = withIdempotency("meetings", handlePost)

/**
 * DELETE (?search=&status=, body `{ ids }` or `{ all: true }`): removes several meetings at once,
 * the ticked ones or every meeting the filters cover. The transcript, what was read from it and its
 * chat go with each one. Final, and only ever within what the viewer may see.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const body = BulkDeleteSchema.safeParse(await req.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ success: false, message: body.error.issues[0]?.message || MEETING_MESSAGES.deleteFailed }, { status: 400 })
  }
  try {
    const params = req.nextUrl.searchParams
    const search = (params.get("search") ?? "").slice(0, MEETING_SEARCH_MAX_LENGTH)
    const status = StatusSchema.parse(params.get("status"))
    const { deleted } = await deleteMeetings(auth.viewer, { search, status }, body.data.ids)
    return NextResponse.json({ success: true, message: `${deleted} ${deleted === 1 ? "meeting" : "meetings"} deleted.`, data: { deleted } })
  } catch (error: unknown) {
    console.error("DELETE Meetings (bulk) Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MEETING_MESSAGES.deleteFailed) }, { status: 500 })
  }
}
