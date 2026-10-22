import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { AccountProfileSchema } from "@/lib/validation/account"
import { ACCOUNT_MESSAGES } from "@/constants/account"
import { updateAccountName } from "@/services/account/profile"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * PUT: the signed-in account's own name, which is what the header, the account menu and the admin
 * pages show. It is the person's own record, so there is nothing to scope and nothing to own: the
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
    const name = await updateAccountName(auth.viewer, parsed.data.name)
    return NextResponse.json({ success: true, message: ACCOUNT_MESSAGES.nameSaved, data: { name } })
  } catch (error: unknown) {
    console.error("PUT Account Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, ACCOUNT_MESSAGES.nameFailed) }, { status: 400 })
  }
}
