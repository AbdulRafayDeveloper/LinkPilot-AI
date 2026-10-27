import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ACTIVITY_MESSAGES } from "@/constants/activityLogs"
import { hideActivity } from "@/services/activityLogs/list"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/** DELETE: the person deletes one of their own activities from their list (a soft delete). Another account's is a 404. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const done = await hideActivity(auth.viewer, (await params).id)
    if (!done) return NextResponse.json({ success: false, message: ACTIVITY_MESSAGES.notFound }, { status: 404 })
    return NextResponse.json({ success: true, message: "Activity deleted.", data: { deleted: 1 } })
  } catch (error: unknown) {
    console.error("DELETE Activity Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, ACTIVITY_MESSAGES.deleteFailed) }, { status: 500 })
  }
}
