import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { UsersQuerySchema } from "@/lib/validation/admin"
import { ADMIN_MESSAGES } from "@/constants/admin"
import { listUsers } from "@/services/admin/users"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET (?cursor=&search=&role=): Admin only. One batch of accounts, newest first, 50 at a time, each
 * with its sign-in counts, last device and how much it has made; the first batch carries the totals.
 */
export async function GET(req: NextRequest) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const parsed = UsersQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || ADMIN_MESSAGES.usersLoadFailed }, { status: 400 })
  }
  try {
    const page = await listUsers(parsed.data)
    return NextResponse.json({ success: true, message: "Accounts retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Admin Users Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, ADMIN_MESSAGES.usersLoadFailed) }, { status: 500 })
  }
}
