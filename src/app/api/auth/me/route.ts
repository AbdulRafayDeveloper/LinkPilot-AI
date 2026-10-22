import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { AUTH_MESSAGES } from "@/constants/auth"
import { isSecureRequest, refreshSession, requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: The signed-in account (name, photo, email, role), which the pages use to show what the role
 * allows.
 *
 * It also **signs the session cookie again** when it is more than a day old, so using the app keeps
 * the person signed in for a year from today rather than from the day they first signed in. Every
 * page load asks this route once (hooks/useCurrentUser), which is what makes it the right place: a
 * cookie may only be set from a route handler, never while a page is rendered.
 */
export async function GET(req: NextRequest) {
  try {
    const { viewer, denied } = await requireViewer()
    if (denied) return denied
    await refreshSession(isSecureRequest(req))
    return NextResponse.json({ success: true, message: "Signed in", data: viewer })
  } catch (error: unknown) {
    console.error("GET Me Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, AUTH_MESSAGES.signInFailed) }, { status: 500 })
  }
}
