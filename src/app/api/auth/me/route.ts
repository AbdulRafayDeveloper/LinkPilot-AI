import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { AUTH_MESSAGES } from "@/constants/auth"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/** GET: The signed-in account (name, email, role), which the pages use to show what the role allows. */
export async function GET() {
  try {
    const { viewer, denied } = await requireViewer()
    if (denied) return denied
    return NextResponse.json({ success: true, message: "Signed in", data: viewer })
  } catch (error: unknown) {
    console.error("GET Me Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, AUTH_MESSAGES.signInFailed) }, { status: 500 })
  }
}
