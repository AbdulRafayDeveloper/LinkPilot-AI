import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { EmployeeOrderSchema } from "@/lib/validation/employees"
import { EMPLOYEE_MESSAGES } from "@/constants/employees"
import { reorderEmployees } from "@/services/employees/employees"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * PUT (body: { orderedIds }): The team in its new order after a drag, every employee top to bottom.
 * An order that no longer names the whole team (someone was added or removed elsewhere) answers 409,
 * and the page reloads the list. Sending the same order again lands on the same order.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = EmployeeOrderSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || EMPLOYEE_MESSAGES.teamOrderFailed }, { status: 400 })
  }
  try {
    const result = await reorderEmployees(auth.viewer, parsed.data.orderedIds)
    if (result === "changed") return NextResponse.json({ success: false, message: EMPLOYEE_MESSAGES.teamOrderChanged }, { status: 409 })
    return NextResponse.json({ success: true, message: "Team order saved", data: { saved: parsed.data.orderedIds.length } })
  } catch (error: unknown) {
    console.error("PUT Employees Order Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, EMPLOYEE_MESSAGES.teamOrderFailed) }, { status: 500 })
  }
}
