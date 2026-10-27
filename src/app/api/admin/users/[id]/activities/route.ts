import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ActivityDeleteSchema, AdminActivityQuerySchema } from "@/lib/validation/activityLogs"
import { ACTIVITY_MESSAGES } from "@/constants/activityLogs"
import { listUserActivities, purgeActivities } from "@/services/activityLogs/list"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET (?page=&search=&module=&action=&outcome=&state=&from=&to=): Admin only. Every activity of one
 * account, newest first, 50 to a page, including the ones the person deleted from their own list
 * (each carries `deletedAt`), with the counts beside it.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const parsed = AdminActivityQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || ACTIVITY_MESSAGES.listFailed }, { status: 400 })
  }
  try {
    const page = await listUserActivities((await params).id, parsed.data)
    if (!page) return NextResponse.json({ success: false, message: ACTIVITY_MESSAGES.userNotFound }, { status: 404 })
    return NextResponse.json({ success: true, message: "Activities retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Admin Activities Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, ACTIVITY_MESSAGES.listFailed) }, { status: 500 })
  }
}

/**
 * DELETE (?the same filters as GET, body `{ ids }` or `{ all: true }`): Admin only. Removes one
 * account's activities from the database for good, the picked ones or every one the filters cover.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const userId = (await params).id
  if (!/^[0-9a-f]{24}$/.test(userId)) {
    return NextResponse.json({ success: false, message: ACTIVITY_MESSAGES.userNotFound }, { status: 404 })
  }
  const filters = AdminActivityQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  const body = ActivityDeleteSchema.safeParse(await req.json().catch(() => null))
  if (!filters.success || !body.success) {
    const issue = filters.success ? body.error?.issues[0]?.message : filters.error.issues[0]?.message
    return NextResponse.json({ success: false, message: issue || ACTIVITY_MESSAGES.deleteFailed }, { status: 400 })
  }
  try {
    const result = await purgeActivities(userId, body.data, filters.data)
    return NextResponse.json({
      success: true,
      message: `${result.deleted} ${result.deleted === 1 ? "activity" : "activities"} permanently deleted.`,
      data: result,
    })
  } catch (error: unknown) {
    console.error("DELETE Admin Activities Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, ACTIVITY_MESSAGES.deleteFailed) }, { status: 500 })
  }
}
