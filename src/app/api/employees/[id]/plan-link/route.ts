import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PlanLinkSchema } from "@/lib/validation/employees"
import { EMPLOYEE_MESSAGES } from "@/constants/employees"
import { setPlanLink } from "@/services/employees/employees"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * POST { action: "create" | "replace" | "disable" }: Turns the employee's own plan link on, gives
 * them a new one (the old one stops working) or turns it off. Answers with the employee, whose
 * `planLink` is the token to share, or null while the link is off.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = PlanLinkSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: EMPLOYEE_MESSAGES.linkFailed }, { status: 400 })
  }
  try {
    const employee = await setPlanLink(auth.viewer, (await params).id, parsed.data.action)
    if (!employee) return NextResponse.json({ success: false, message: EMPLOYEE_MESSAGES.notFound }, { status: 404 })
    return NextResponse.json({ success: true, message: "Link updated", data: employee })
  } catch (error: unknown) {
    console.error("POST Employee Plan Link Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, EMPLOYEE_MESSAGES.linkFailed) }, { status: 500 })
  }
}
