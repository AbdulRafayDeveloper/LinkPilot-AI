import { NextRequest, NextResponse } from "next/server"
import { env } from "@/config/env"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { SignupSchema } from "@/lib/validation/auth"
import { AUTH_MESSAGES } from "@/constants/auth"
import { signUp } from "@/services/auth/accounts"
import { startSession } from "@/services/auth/viewer"
import { clientInfo } from "@/services/auth/audit"

export const dynamic = "force-dynamic"

/**
 * POST: Creates a `user` account and signs it in, only while ALLOW_SIGNUP is "true". An admin is
 * never created here, whatever the request says.
 */
export async function POST(req: NextRequest) {
  if (env.ALLOW_SIGNUP !== "true") {
    return NextResponse.json({ success: false, message: AUTH_MESSAGES.signupClosed }, { status: 403 })
  }

  const parsed = SignupSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || AUTH_MESSAGES.signupFailed }, { status: 400 })
  }

  try {
    const { viewer, sessionVersion } = await signUp(parsed.data, clientInfo(req))
    await startSession({ id: viewer.id, sessionVersion }, req.nextUrl.protocol === "https:")
    return NextResponse.json({ success: true, message: `Welcome, ${viewer.name}.`, data: viewer }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof UserFacingError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.message === AUTH_MESSAGES.emailTaken ? 409 : 400 })
    }
    console.error("POST Signup Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, AUTH_MESSAGES.signupFailed) }, { status: 500 })
  }
}
