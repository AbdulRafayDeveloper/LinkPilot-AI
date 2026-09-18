import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { EmployeeSchema, EmployeesQuerySchema } from "@/lib/validation/employees"
import { EMPLOYEE_MESSAGES } from "@/constants/employees"
import { createEmployee, deleteEmployees, listEmployees } from "@/services/employees/employees"
import { BulkDeleteSchema } from "@/lib/validation/listFilters"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

/** GET (?search=&status=): The whole team (up to EMPLOYEES_LIST_MAX) in its dragged order, newest first where no order was set, with the active and inactive counts. */
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
async function handlePost(req: NextRequest) {
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

// A retry of the same request (same Idempotency-Key) gets the first answer back instead of running again
export const POST = withIdempotency("employees", handlePost)

/**
 * DELETE (?search=&status=, body `{ ids }` or `{ all: true }`): removes several employees at once,
 * the ticked ones or everyone the filters cover. Each takes their daily plans with them. Final, and
 * only ever within the team the viewer may see.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const body = BulkDeleteSchema.safeParse(await req.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ success: false, message: body.error.issues[0]?.message || EMPLOYEE_MESSAGES.deleteFailed }, { status: 400 })
  }
  try {
    // The same filters the list takes, read the same way, so a delete matches what was on screen
    const filters = EmployeesQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!filters.success) {
      return NextResponse.json({ success: false, message: filters.error.issues[0]?.message || EMPLOYEE_MESSAGES.deleteFailed }, { status: 400 })
    }
    const { deleted } = await deleteEmployees(auth.viewer, filters.data, body.data.ids)
    return NextResponse.json({ success: true, message: `${deleted} ${deleted === 1 ? "employee" : "employees"} deleted.`, data: { deleted } })
  } catch (error: unknown) {
    console.error("DELETE Employees (bulk) Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, EMPLOYEE_MESSAGES.deleteFailed) }, { status: 500 })
  }
}
