import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { AccountProfileSchema } from "@/lib/validation/account"
import { ACCOUNT_MESSAGES } from "@/constants/account"
import { updateAccountProfile } from "@/services/account/profile"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * PUT: the signed-in account's own name (what the header, the account menu and the admin pages show)
 * and its timezone (what every time in the app is shown in), either or both, each written only when
 * it is sent. It is the person's own record, so there is nothing to scope and nothing to own: the
 * account changed is always the one making the request.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = AccountProfileSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || ACCOUNT_MESSAGES.nameFailed }, { status: 400 })
  }
  try {
    const saved = await updateAccountProfile(auth.viewer, parsed.data)
    const message = parsed.data.name === undefined ? ACCOUNT_MESSAGES.timeZoneSaved : ACCOUNT_MESSAGES.nameSaved
    return NextResponse.json({ success: true, message, data: saved })
  } catch (error: unknown) {
    console.error("PUT Account Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, ACCOUNT_MESSAGES.nameFailed) }, { status: 400 })
  }
}
