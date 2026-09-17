import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { EmployeeSchema } from "@/lib/validation/employees"
import { EMPLOYEE_MESSAGES } from "@/constants/employees"
import { deleteEmployee, getEmployee, updateEmployee } from "@/services/employees/employees"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

const notFound = () => NextResponse.json({ success: false, message: EMPLOYEE_MESSAGES.notFound }, { status: 404 })

/** GET: One employee. Another account's employee reads as not found. */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const employee = await getEmployee(auth.viewer, (await params).id)
    return employee ? NextResponse.json({ success: true, message: "Employee retrieved", data: employee }) : notFound()
  } catch (error: unknown) {
    console.error("GET Employee Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, EMPLOYEE_MESSAGES.loadFailed) }, { status: 500 })
  }
}

/** PUT: Replaces an employee's name, city, role, joining date and status. */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = EmployeeSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || EMPLOYEE_MESSAGES.saveFailed }, { status: 400 })
  }
  try {
    const employee = await updateEmployee(auth.viewer, (await params).id, parsed.data)
    return employee ? NextResponse.json({ success: true, message: EMPLOYEE_MESSAGES.saved, data: employee }) : notFound()
  } catch (error: unknown) {
    console.error("PUT Employee Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, EMPLOYEE_MESSAGES.saveFailed) }, { status: 500 })
  }
}

/** DELETE: Removes an employee and all of their plans. The page confirms first. */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const removed = await deleteEmployee(auth.viewer, (await params).id)
    return removed ? NextResponse.json({ success: true, message: EMPLOYEE_MESSAGES.deleted, data: { deleted: 1 } }) : notFound()
  } catch (error: unknown) {
    console.error("DELETE Employee Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, EMPLOYEE_MESSAGES.deleteFailed) }, { status: 500 })
  }
}
