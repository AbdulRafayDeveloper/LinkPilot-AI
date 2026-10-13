import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { MAX_LINKED_AT_ONCE, MEETING_PLAN_LINK_MESSAGES } from "@/constants/meetings"
import { linkMeetingsToPlan } from "@/services/meetings/planLink"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

const ID = z.string().regex(/^[0-9a-f]{24}$/)

/**
 * Which records are being linked, and to which planned meeting. `planId: null` unlinks them, which
 * is the same call with nothing to point at, so the page needs one request for both.
 */
const LinkSchema = z.object({
  meetingIds: z.array(ID).min(1, MEETING_PLAN_LINK_MESSAGES.linkFailed).max(MAX_LINKED_AT_ONCE, MEETING_PLAN_LINK_MESSAGES.tooMany),
  planId: z.union([ID, z.null()]),
})

/**
 * PUT: links the named meetings to a planned meeting, or unlinks them.
 *
 * Both sides are held to what this account may see, so a link can only ever be made between a
 * meeting and a planned meeting of the same account; an id belonging to another one changes
 * nothing. Nothing of the meeting itself is touched: a link is one field on the record.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const parsed = LinkSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || MEETING_PLAN_LINK_MESSAGES.linkFailed },
        { status: 400 }
      )
    }
    const { meetingIds, planId } = parsed.data
    const result = await linkMeetingsToPlan(auth.viewer, meetingIds, planId)
    const message = planId ? MEETING_PLAN_LINK_MESSAGES.linked(result.changed) : MEETING_PLAN_LINK_MESSAGES.unlinked(result.changed)
    return NextResponse.json({ success: true, message, data: result })
  } catch (error: unknown) {
    console.error("PUT Meeting Plan Link Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, MEETING_PLAN_LINK_MESSAGES.linkFailed) },
      { status: 500 }
    )
  }
}
