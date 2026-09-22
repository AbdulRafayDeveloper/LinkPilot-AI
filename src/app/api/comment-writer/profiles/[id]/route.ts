import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { ProfileScheduleSchema } from "@/lib/validation/profileSchedules"
import { PROFILE_SCHEDULER_MESSAGES } from "@/constants/profileScheduler"
import { deleteProfileSchedule, updateProfileSchedule } from "@/services/commentWriter/profileSchedules"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

const notFound = () => NextResponse.json({ success: false, message: PROFILE_SCHEDULER_MESSAGES.notFound }, { status: 404 })

/** PUT { profileUrl, days }: Replaces one profile's link and days. Another account's profile reads as not found. */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ProfileScheduleSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || PROFILE_SCHEDULER_MESSAGES.saveFailed }, { status: 400 })
  }
  try {
    const schedule = await updateProfileSchedule(auth.viewer, (await params).id, parsed.data)
    return schedule ? NextResponse.json({ success: true, message: PROFILE_SCHEDULER_MESSAGES.updated, data: schedule }) : notFound()
  } catch (error: unknown) {
    if (error instanceof UserFacingError && error.message === PROFILE_SCHEDULER_MESSAGES.duplicate) {
      return NextResponse.json({ success: false, message: error.message }, { status: 409 })
    }
    console.error("PUT Profile Schedule Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROFILE_SCHEDULER_MESSAGES.saveFailed) }, { status: 500 })
  }
}

/** DELETE: Removes one profile. The page confirms first. */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const removed = await deleteProfileSchedule(auth.viewer, (await params).id)
    return removed ? NextResponse.json({ success: true, message: PROFILE_SCHEDULER_MESSAGES.deleted, data: { deleted: 1 } }) : notFound()
  } catch (error: unknown) {
    console.error("DELETE Profile Schedule Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROFILE_SCHEDULER_MESSAGES.deleteFailed) }, { status: 500 })
  }
}
