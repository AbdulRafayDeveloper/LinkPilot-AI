import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ActivityDeleteSchema, ActivityQuerySchema } from "@/lib/validation/activityLogs"
import { ACTIVITY_MESSAGES } from "@/constants/activityLogs"
import { hideActivities, listOwnActivities } from "@/services/activityLogs/list"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET (?page=&search=&module=&action=&outcome=&from=&to=): the signed-in person's own activities,
 * newest first, 50 to a page, filtered in the database. Nobody reaches another account's here, an
 * admin included: an admin reads someone else's from User Management.
 */
export async function GET(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ActivityQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || ACTIVITY_MESSAGES.listFailed }, { status: 400 })
  }
  try {
    const page = await listOwnActivities(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: "Activities retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Activity Logs Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, ACTIVITY_MESSAGES.listFailed) }, { status: 500 })
  }
}

/**
 * DELETE (?the same filters as GET, body `{ ids }` or `{ all: true }`): the person deletes their own
 * activities, the picked ones or every one the filters cover. They leave the person's list and stay
 * in the database for the administrators (a soft delete).
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const filters = ActivityQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  const body = ActivityDeleteSchema.safeParse(await req.json().catch(() => null))
  if (!filters.success || !body.success) {
    const issue = filters.success ? body.error?.issues[0]?.message : filters.error.issues[0]?.message
    return NextResponse.json({ success: false, message: issue || ACTIVITY_MESSAGES.deleteFailed }, { status: 400 })
  }
  try {
    const result = await hideActivities(auth.viewer, body.data, filters.data)
    return NextResponse.json({ success: true, message: `${result.deleted} ${result.deleted === 1 ? "activity" : "activities"} deleted.`, data: result })
  } catch (error: unknown) {
    console.error("DELETE Activity Logs Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, ACTIVITY_MESSAGES.deleteFailed) }, { status: 500 })
  }
}
