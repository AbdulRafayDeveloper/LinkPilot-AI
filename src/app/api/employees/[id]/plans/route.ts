import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { OrderSchema, PlanQuerySchema, PlanSchema, TickSchema } from "@/lib/validation/employees"
import { EMPLOYEE_MESSAGES } from "@/constants/employees"
import { getPlan, reorderPlan, savePlan, tickPlanItem } from "@/services/employees/employees"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

const notFound = (message: string = EMPLOYEE_MESSAGES.notFound) => NextResponse.json({ success: false, message }, { status: 404 })
const badRequest = (message: string) => NextResponse.json({ success: false, message }, { status: 400 })

/** GET (?today=YYYY-MM-DD): The employee's daily plan (it repeats every day) with today's ticks and the notes. */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = PlanQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || EMPLOYEE_MESSAGES.planLoadFailed)
  try {
    const plan = await getPlan(auth.viewer, (await params).id, parsed.data.today)
    return plan ? NextResponse.json({ success: true, message: "Plan retrieved", data: plan }) : notFound()
  } catch (error: unknown) {
    console.error("GET Employee Plan Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, EMPLOYEE_MESSAGES.planLoadFailed) }, { status: 500 })
  }
}

/** PUT { today, items, notes }: Replaces the plan's tasks and notes from today on. Ticks are left as they are. */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = PlanSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || EMPLOYEE_MESSAGES.planSaveFailed)
  try {
    const plan = await savePlan(auth.viewer, (await params).id, parsed.data)
    return plan ? NextResponse.json({ success: true, message: "Plan saved", data: plan }) : notFound()
  } catch (error: unknown) {
    console.error("PUT Employee Plan Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, EMPLOYEE_MESSAGES.planSaveFailed) }, { status: 500 })
  }
}

/** PATCH { today, itemId, done }: Ticks or unticks one of today's tasks, recording when it was ticked. */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = TickSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || EMPLOYEE_MESSAGES.tickFailed)
  try {
    const { today, itemId, done } = parsed.data
    const plan = await tickPlanItem(auth.viewer, (await params).id, today, itemId, done)
    return plan ? NextResponse.json({ success: true, message: "Tick saved", data: plan }) : notFound(EMPLOYEE_MESSAGES.itemNotFound)
  } catch (error: unknown) {
    console.error("PATCH Employee Plan Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, EMPLOYEE_MESSAGES.tickFailed) }, { status: 500 })
  }
}

/** POST { today, order }: Puts the plan's tasks in a new order. 409 when the plan changed meanwhile. */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = OrderSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || EMPLOYEE_MESSAGES.orderFailed)
  try {
    const plan = await reorderPlan(auth.viewer, (await params).id, parsed.data.today, parsed.data.order)
    if (plan === "changed") return NextResponse.json({ success: false, message: EMPLOYEE_MESSAGES.orderChanged }, { status: 409 })
    return plan ? NextResponse.json({ success: true, message: "Order saved", data: plan }) : notFound()
  } catch (error: unknown) {
    console.error("POST Employee Plan Order Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, EMPLOYEE_MESSAGES.orderFailed) }, { status: 500 })
  }
}
