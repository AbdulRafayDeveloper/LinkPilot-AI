import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { AuditQuerySchema } from "@/lib/validation/admin"
import { ADMIN_MESSAGES } from "@/constants/admin"
import { listLoginEvents } from "@/services/admin/audit"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET (?cursor=&search=&event=&userId=&from=&to=): Admin only. One batch of the audit log, newest
 * first, 50 at a time; the first batch also carries the summary counts.
 */
export async function GET(req: NextRequest) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const parsed = AuditQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || ADMIN_MESSAGES.auditLoadFailed }, { status: 400 })
  }
  try {
    const page = await listLoginEvents(parsed.data)
    return NextResponse.json({ success: true, message: "Audit log retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Audit Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, ADMIN_MESSAGES.auditLoadFailed) }, { status: 500 })
  }
}
