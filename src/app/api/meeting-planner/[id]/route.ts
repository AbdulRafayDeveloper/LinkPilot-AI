import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { DELETE_SCOPES, MEETING_PLANNER_MESSAGES, MEETING_PLAN_STATUS_IDS } from "@/constants/meetingPlanner"
import { deleteMeeting, deleteSeries, getMeeting, seriesSizeOf, updateMeeting } from "@/services/meetingPlanner/plans"
import { MeetingInputSchema, hasPrepInput } from "../route"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * Everything is optional here: the status toggle sends one field, the edit form sends several.
 *
 * `prepEnabled` is spelled out again rather than taken from the partial, because on the create
 * schema it carries a default of false, and a default still answers for a key that was not sent.
 * That made every small change switch preparation off: ticking a meeting completed, which sends
 * nothing but the status, took its preparation away with it. Left optional with no default, a
 * change that says nothing about preparation leaves preparation alone.
 */
export const UpdateSchema = MeetingInputSchema.partial()
  .extend({ prepEnabled: z.boolean().optional(), status: z.enum(MEETING_PLAN_STATUS_IDS).optional() })
  .refine((body) => Object.keys(body).length > 0, MEETING_PLANNER_MESSAGES.updateFailed)

// Which meetings a DELETE takes: this one (the default, as before) or its whole series
const DeleteScopeSchema = z.enum(DELETE_SCOPES).catch("one")

const notFound = () => NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.notFound }, { status: 404 })

/**
 * GET: one meeting with everything saved on it, including the preparation. The page reads this;
 * nothing is ever generated here, so opening a meeting never calls a model.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const meeting = await getMeeting(auth.viewer, (await params).id)
    if (!meeting) return notFound()
    // A meeting in a series says how many the series still holds, so deleting can name the count
    const data = meeting.seriesId ? { ...meeting, seriesSize: await seriesSizeOf(auth.viewer, meeting.seriesId) } : meeting
    return NextResponse.json({ success: true, message: "Meeting retrieved", data })
  } catch (error: unknown) {
    console.error("GET Meeting Plan Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, MEETING_PLANNER_MESSAGES.loadFailed) },
      { status: 500 }
    )
  }
}

/**
 * PUT: changes the scheduling details, the status or the preparation inputs. Saved preparation
 * is left alone; it is only rewritten when the user asks for it on the preparation route.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || MEETING_PLANNER_MESSAGES.updateFailed },
        { status: 400 }
      )
    }

    const { id } = await params
    const current = await getMeeting(auth.viewer, id)
    if (!current) return notFound()

    // Switching preparation on needs something to read, whether it comes with this change or was already saved
    const changes = parsed.data
    if (changes.prepEnabled === true) {
      const inputs = {
        profileInfo: changes.profileInfo !== undefined ? changes.profileInfo : current.profileInfo,
        conversationHistory:
          changes.conversationHistory !== undefined ? changes.conversationHistory : current.conversationHistory,
        additionalInfo: changes.additionalInfo !== undefined ? changes.additionalInfo : current.additionalInfo,
      }
      if (!hasPrepInput(inputs)) {
        return NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.prepNeedsInput }, { status: 400 })
      }
    }

    const meeting = await updateMeeting(auth.viewer, id, changes)
    if (!meeting) return notFound()
    const message = changes.status ? MEETING_PLANNER_MESSAGES.statusUpdated : MEETING_PLANNER_MESSAGES.updated
    return NextResponse.json({ success: true, message, data: meeting })
  } catch (error: unknown) {
    console.error("PUT Meeting Plan Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, MEETING_PLANNER_MESSAGES.updateFailed) },
      { status: 500 }
    )
  }
}

/**
 * DELETE: removes one meeting and its preparation. With `?scope=series` it removes every meeting of
 * the series this one belongs to (only this one, when it is in none) and answers how many went.
 * Without it, or with anything else, it deletes this meeting alone, exactly as it always has, which
 * is also how one occurrence of a series is taken out while the rest stay.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const { id } = await params
    if (DeleteScopeSchema.parse(req.nextUrl.searchParams.get("scope") ?? undefined) === "series") {
      const count = await deleteSeries(auth.viewer, id)
      if (count === 0) return notFound()
      return NextResponse.json({ success: true, message: MEETING_PLANNER_MESSAGES.seriesDeleted(count), data: { deleted: true, count } })
    }
    const deleted = await deleteMeeting(auth.viewer, id)
    if (!deleted) return notFound()
    return NextResponse.json({ success: true, message: MEETING_PLANNER_MESSAGES.deleted, data: { deleted: true, count: 1 } })
  } catch (error: unknown) {
    console.error("DELETE Meeting Plan Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, MEETING_PLANNER_MESSAGES.deleteFailed) },
      { status: 500 }
    )
  }
}
