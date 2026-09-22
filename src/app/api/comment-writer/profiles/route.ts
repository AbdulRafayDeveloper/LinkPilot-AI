import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { ProfileScheduleQuerySchema, ProfileScheduleSchema } from "@/lib/validation/profileSchedules"
import { BulkDeleteSchema } from "@/lib/validation/listFilters"
import { PROFILE_SCHEDULER_MESSAGES } from "@/constants/profileScheduler"
import { createProfileSchedule, deleteProfileSchedules, listProfileSchedules } from "@/services/commentWriter/profileSchedules"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

/** GET (?page=&search=&day=&type=): One page of 50 people, newest first, with how many each day and each type has. */
export async function GET(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ProfileScheduleQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || PROFILE_SCHEDULER_MESSAGES.loadFailed }, { status: 400 })
  }
  try {
    const page = await listProfileSchedules(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: "Profiles retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Profile Schedules Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROFILE_SCHEDULER_MESSAGES.loadFailed) }, { status: 500 })
  }
}

/**
 * POST { days, profileUrl?, name?, role?, location?, sector?, types? }: saves one person to this
 * account; a name or a link is required. The same LinkedIn link again answers 409.
 */
async function handlePost(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ProfileScheduleSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || PROFILE_SCHEDULER_MESSAGES.saveFailed }, { status: 400 })
  }
  try {
    const schedule = await createProfileSchedule(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: PROFILE_SCHEDULER_MESSAGES.created, data: schedule }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof UserFacingError && error.message === PROFILE_SCHEDULER_MESSAGES.duplicate) {
      return NextResponse.json({ success: false, message: error.message }, { status: 409 })
    }
    console.error("POST Profile Schedule Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROFILE_SCHEDULER_MESSAGES.saveFailed) }, { status: 500 })
  }
}

// A retry of the same request (same Idempotency-Key) gets the first answer back instead of running again
export const POST = withIdempotency("comment-writer-profiles", handlePost)

/**
 * DELETE (?search=&day=&type=, body `{ ids }` or `{ all: true }`): removes several profiles at once, the
 * ticked ones or everything the filters cover. Final.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const filters = ProfileScheduleQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  const body = BulkDeleteSchema.safeParse(await req.json().catch(() => null))
  if (!filters.success || !body.success) {
    const issue = filters.success ? body.error?.issues[0]?.message : filters.error.issues[0]?.message
    return NextResponse.json({ success: false, message: issue || PROFILE_SCHEDULER_MESSAGES.deleteFailed }, { status: 400 })
  }
  try {
    const { deleted } = await deleteProfileSchedules(auth.viewer, filters.data, body.data.ids)
    return NextResponse.json({ success: true, message: `${deleted} ${deleted === 1 ? "profile" : "profiles"} deleted.`, data: { deleted } })
  } catch (error: unknown) {
    console.error("DELETE Profile Schedules (bulk) Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROFILE_SCHEDULER_MESSAGES.deleteFailed) }, { status: 500 })
  }
}
