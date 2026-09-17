import { NextRequest, NextResponse } from "next/server"
import { UserFacingError } from "@/lib/errors"
import { LoginSchema } from "@/lib/validation/auth"
import { AUTH_MESSAGES } from "@/constants/auth"
import { signIn } from "@/services/auth/accounts"
import { startSession } from "@/services/auth/viewer"
import { clientInfo } from "@/services/auth/audit"

export const dynamic = "force-dynamic"

/**
 * POST: Signs in with an email and password and starts a session in this browser. A wrong email
 * and a wrong password get the same answer; too many wrong passwords lock the account for a while.
 */
export async function POST(req: NextRequest) {
  const parsed = LoginSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || AUTH_MESSAGES.badCredentials }, { status: 400 })
  }

  try {
    const { viewer, sessionVersion } = await signIn(parsed.data, clientInfo(req))
    await startSession({ id: viewer.id, sessionVersion }, req.nextUrl.protocol === "https:")
    return NextResponse.json({ success: true, message: `Welcome back, ${viewer.name}.`, data: viewer })
  } catch (error: unknown) {
    if (error instanceof UserFacingError) {
      const status = error.message === AUTH_MESSAGES.locked ? 429 : 401
      return NextResponse.json({ success: false, message: error.message }, { status })
    }
    console.error("POST Login Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: AUTH_MESSAGES.signInFailed }, { status: 500 })
  }
}
