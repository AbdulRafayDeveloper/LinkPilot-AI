import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { MEETING_PLANNER_MESSAGES, MEETING_PLAN_STATUS_IDS } from "@/constants/meetingPlanner"
import { deleteMeeting, getMeeting, updateMeeting } from "@/services/meetingPlanner/plans"
import { MeetingInputSchema, hasPrepInput } from "../route"

export const dynamic = "force-dynamic"

// Everything is optional here: the status toggle sends one field, the edit form sends several
const UpdateSchema = MeetingInputSchema.partial()
  .extend({ status: z.enum(MEETING_PLAN_STATUS_IDS).optional() })
  .refine((body) => Object.keys(body).length > 0, MEETING_PLANNER_MESSAGES.updateFailed)

const notFound = () => NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.notFound }, { status: 404 })

/**
 * GET: one meeting with everything saved on it, including the preparation. The page reads this;
 * nothing is ever generated here, so opening a meeting never calls a model.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const meeting = await getMeeting((await params).id)
    if (!meeting) return notFound()
    return NextResponse.json({ success: true, message: "Meeting retrieved", data: meeting })
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
    const current = await getMeeting(id)
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

    const meeting = await updateMeeting(id, changes)
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
 * DELETE: removes one meeting and its preparation.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const deleted = await deleteMeeting((await params).id)
    if (!deleted) return notFound()
    return NextResponse.json({ success: true, message: MEETING_PLANNER_MESSAGES.deleted, data: { deleted: true } })
  } catch (error: unknown) {
    console.error("DELETE Meeting Plan Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, MEETING_PLANNER_MESSAGES.deleteFailed) },
      { status: 500 }
    )
  }
}
