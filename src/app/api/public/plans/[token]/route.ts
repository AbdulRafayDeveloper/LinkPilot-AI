import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { HistoryQuerySchema, OrderSchema, ResetSchema, TickSchema, TodaySchema } from "@/lib/validation/employees"
import { EMPLOYEE_MESSAGES } from "@/constants/employees"
import { getPublicHistory, getPublicPlan, reorderPublicPlan, resetPublicDay, tickPublicItem } from "@/services/employees/employees"

export const dynamic = "force-dynamic"

/**
 * The employee's own link, reachable without signing in (src/proxy.ts lets /api/public/ through).
 * The signed token in the address is the only key: it opens one employee's daily plan and nothing
 * else, shows only their name, role, tasks and ticks, and allows ticking, unticking and resetting
 * today and moving tasks up and down. Nothing can be added, reworded or deleted from here, and no
 * earlier day can be changed.
 */

type RouteContext = { params: Promise<{ token: string }> }

// Every refusal about the link itself reads the same, so a guessed token learns nothing
const invalidLink = () => NextResponse.json({ success: false, message: EMPLOYEE_MESSAGES.linkInvalid }, { status: 404 })
const noStore = { "Cache-Control": "no-store" }

/**
 * GET (?today=YYYY-MM-DD): today's tasks and the history before today.
 * GET (?before=YYYY-MM-DD): the next, older page of history.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { token } = await params
  const query = Object.fromEntries(req.nextUrl.searchParams)
  try {
    if (query.before) {
      const parsed = HistoryQuerySchema.safeParse(query)
      if (!parsed.success) return NextResponse.json({ success: false, message: EMPLOYEE_MESSAGES.historyFailed }, { status: 400 })
      const history = await getPublicHistory(token, parsed.data.before)
      return history ? NextResponse.json({ success: true, message: "History retrieved", data: history }, { headers: noStore }) : invalidLink()
    }
    const today = TodaySchema.safeParse(query.today)
    if (!today.success) return NextResponse.json({ success: false, message: EMPLOYEE_MESSAGES.badToday }, { status: 400 })
    const plan = await getPublicPlan(token, today.data)
    return plan ? NextResponse.json({ success: true, message: "Plan retrieved", data: plan }, { headers: noStore }) : invalidLink()
  } catch (error: unknown) {
    console.error("GET Public Plan Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, EMPLOYEE_MESSAGES.planLoadFailed) }, { status: 500 })
  }
}

/** PATCH { today, itemId, done }: ticks or unticks one of today's tasks. */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const parsed = TickSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || EMPLOYEE_MESSAGES.tickFailed }, { status: 400 })
  }
  try {
    const { today, itemId, done } = parsed.data
    const result = await tickPublicItem((await params).token, today, itemId, done)
    if (result === null) return invalidLink()
    if (result === "no-item") return NextResponse.json({ success: false, message: EMPLOYEE_MESSAGES.itemNotFound }, { status: 404 })
    return NextResponse.json({ success: true, message: "Tick saved", data: result }, { headers: noStore })
  } catch (error: unknown) {
    console.error("PATCH Public Plan Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, EMPLOYEE_MESSAGES.tickFailed) }, { status: 500 })
  }
}

/** POST { today }: clears every tick on today's plan. Earlier days, and the tasks themselves, stay. */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const parsed = ResetSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || EMPLOYEE_MESSAGES.resetFailed }, { status: 400 })
  }
  try {
    const result = await resetPublicDay((await params).token, parsed.data.today)
    return result ? NextResponse.json({ success: true, message: "Today's ticks cleared", data: result }, { headers: noStore }) : invalidLink()
  } catch (error: unknown) {
    console.error("POST Public Plan Reset Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, EMPLOYEE_MESSAGES.resetFailed) }, { status: 500 })
  }
}

/** PUT { today, order }: moves tasks up and down for this link only (the plan keeps its order) until Reset today. 409 when the plan changed meanwhile. */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const parsed = OrderSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || EMPLOYEE_MESSAGES.orderFailed }, { status: 400 })
  }
  try {
    const result = await reorderPublicPlan((await params).token, parsed.data.today, parsed.data.order)
    if (result === null) return invalidLink()
    if (result === "changed") return NextResponse.json({ success: false, message: EMPLOYEE_MESSAGES.orderChanged }, { status: 409 })
    return NextResponse.json({ success: true, message: "Order saved", data: result }, { headers: noStore })
  } catch (error: unknown) {
    console.error("PUT Public Plan Order Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, EMPLOYEE_MESSAGES.orderFailed) }, { status: 500 })
  }
}
