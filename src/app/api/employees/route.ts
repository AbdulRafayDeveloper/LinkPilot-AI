import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { EmployeeSchema, EmployeesQuerySchema } from "@/lib/validation/employees"
import { EMPLOYEE_MESSAGES } from "@/constants/employees"
import { createEmployee, listEmployees } from "@/services/employees/employees"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/** GET (?cursor=&search=&status=): One batch of employees, newest first, 50 at a time, with the active and inactive counts. */
export async function GET(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = EmployeesQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || EMPLOYEE_MESSAGES.loadFailed }, { status: 400 })
  }
  try {
    const page = await listEmployees(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: "Employees retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Employees Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, EMPLOYEE_MESSAGES.loadFailed) }, { status: 500 })
  }
}

/** POST: Adds an employee to this account. */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = EmployeeSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || EMPLOYEE_MESSAGES.saveFailed }, { status: 400 })
  }
  try {
    const employee = await createEmployee(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: EMPLOYEE_MESSAGES.created, data: employee }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Employee Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, EMPLOYEE_MESSAGES.saveFailed) }, { status: 500 })
  }
}
