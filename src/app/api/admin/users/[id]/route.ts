import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { DeleteAccountSchema } from "@/lib/validation/admin"
import { ADMIN_MESSAGES } from "@/constants/admin"
import { getUserActivity } from "@/services/admin/users"
import { deleteAccount } from "@/services/admin/deleteAccount"
import { clientInfo } from "@/services/auth/audit"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/** GET: Admin only. One account with its tool-by-tool activity and its latest sign-in events. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  try {
    const activity = await getUserActivity((await params).id)
    if (!activity) return NextResponse.json({ success: false, message: ADMIN_MESSAGES.userNotFound }, { status: 404 })
    return NextResponse.json({ success: true, message: "Account activity retrieved", data: activity })
  } catch (error: unknown) {
    console.error("GET Admin User Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, ADMIN_MESSAGES.usersLoadFailed) }, { status: 500 })
  }
}

/**
 * DELETE (body: { confirmEmail }): Admin only. Deletes the account and everything it made in every
 * tool, including its stored files. Refused (400) for the admin's own account, the only admin, or an
 * email that doesn't match; 404 when the account is already gone.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const parsed = DeleteAccountSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || ADMIN_MESSAGES.confirmEmailMismatch }, { status: 400 })
  }

  try {
    const deletion = await deleteAccount(auth.viewer, (await params).id, parsed.data.confirmEmail, clientInfo(req))
    if (!deletion) return NextResponse.json({ success: false, message: ADMIN_MESSAGES.userNotFound }, { status: 404 })
    return NextResponse.json({ success: true, message: `${deletion.name}'s account and everything it made were deleted.`, data: deletion })
  } catch (error: unknown) {
    if (error instanceof UserFacingError) {
      const status = error.message === ADMIN_MESSAGES.storageUnavailable ? 409 : 400
      return NextResponse.json({ success: false, message: error.message }, { status })
    }
    console.error("DELETE Admin User Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, ADMIN_MESSAGES.deleteFailed) }, { status: 500 })
  }
}
