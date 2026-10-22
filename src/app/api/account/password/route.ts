import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { ChangePasswordSchema } from "@/lib/validation/account"
import { ACCOUNT_MESSAGES } from "@/constants/account"
import { changeAccountPassword } from "@/services/account/profile"
import { clientInfo } from "@/services/auth/audit"
import { isSecureRequest, requireViewer, startSession } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * PUT: a new password for the signed-in account, after checking the one it signs in with now.
 *
 * Every session the account has ends (`sessionVersion` goes up), which is the point of changing a
 * password, and **this browser is signed in again on the way out** with the new version, so the
 * person is not thrown back to the sign-in page for doing the right thing. A wrong current password
 * is a 400 saying exactly that, so the form can mark the field rather than showing a general error.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ChangePasswordSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || ACCOUNT_MESSAGES.passwordFailed }, { status: 400 })
  }
  try {
    const sessionVersion = await changeAccountPassword(auth.viewer, parsed.data, clientInfo(req))
    await startSession({ id: auth.viewer.id, sessionVersion }, isSecureRequest(req))
    return NextResponse.json({ success: true, message: ACCOUNT_MESSAGES.passwordChanged, data: { changed: true } })
  } catch (error: unknown) {
    if (error instanceof UserFacingError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    }
    console.error("PUT Account Password Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, ACCOUNT_MESSAGES.passwordFailed) }, { status: 500 })
  }
}
