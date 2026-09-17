import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { DayActionSchema, HistoryQuerySchema, OrderSchema, ReasonSchema, TickSchema, TodaySchema } from "@/lib/validation/employees"
import { EMPLOYEE_MESSAGES } from "@/constants/employees"
import {
  cancelPublicDay,
  getPublicHistory,
  getPublicPlan,
  reorderPublicPlan,
  resetPublicDay,
  savePublicHistoryItemReason,
  savePublicItemReason,
  startPublicNewDay,
  tickPublicHistoryItem,
  tickPublicItem,
} from "@/services/employees/employees"

export const dynamic = "force-dynamic"

/**
 * The employee's own link, reachable without signing in (src/proxy.ts lets /api/public/ through).
 * The signed token in the address is the only key: it opens one employee's daily plan and nothing
 * else, shows only their name, role, tasks and ticks, and allows ticking and unticking (on the day
 * they are working on and on any day in their history), resetting that day, moving tasks up and
 * down, and starting a new day. Nothing can be added, reworded or deleted from here, and no day's
 * tasks can be changed, only its ticks.
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

/**
 * PATCH { today, itemId, done }: ticks or unticks one task of the day being worked on.
 * PATCH { today, date, itemId, done }: the same on that day in the history, which stays tickable.
 * PATCH { today, itemId, reason } (with `date` for a day in the history): saves why that task
 * wasn't finished, in the employee's own words; an empty reason takes it back off.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const body: unknown = await req.json().catch(() => null)
  // A reason is told from a tick by the field it carries, so a reason that is too long is refused
  // as a reason rather than falling through and complaining about a missing tick
  if (typeof (body as { reason?: unknown } | null)?.reason === "string") {
    const asReason = ReasonSchema.safeParse(body)
    if (!asReason.success) {
      return NextResponse.json({ success: false, message: asReason.error.issues[0]?.message || EMPLOYEE_MESSAGES.reasonFailed }, { status: 400 })
    }
    try {
      const { today, date, itemId, reason } = asReason.data
      const { token } = await params
      const saved = date
        ? await savePublicHistoryItemReason(token, date, itemId, reason)
        : await savePublicItemReason(token, today, itemId, reason)
      if (saved === null) return invalidLink()
      if (saved === "no-item") {
        return NextResponse.json({ success: false, message: date ? EMPLOYEE_MESSAGES.dayNotFound : EMPLOYEE_MESSAGES.itemNotFound }, { status: 404 })
      }
      return NextResponse.json({ success: true, message: reason ? "Reason saved" : "Reason removed", data: saved }, { headers: noStore })
    } catch (error: unknown) {
      console.error("PATCH Public Plan Reason Exception:", error instanceof Error ? error.message : error)
      return NextResponse.json({ success: false, message: toUserFacingMessage(error, EMPLOYEE_MESSAGES.reasonFailed) }, { status: 500 })
    }
  }

  const parsed = TickSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || EMPLOYEE_MESSAGES.tickFailed }, { status: 400 })
  }
  try {
    const { today, date, itemId, done } = parsed.data
    const { token } = await params
    const result = date ? await tickPublicHistoryItem(token, date, itemId, done) : await tickPublicItem(token, today, itemId, done)
    if (result === null) return invalidLink()
    if (result === "no-item") {
      return NextResponse.json({ success: false, message: date ? EMPLOYEE_MESSAGES.dayNotFound : EMPLOYEE_MESSAGES.itemNotFound }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: "Tick saved", data: result }, { headers: noStore })
  } catch (error: unknown) {
    console.error("PATCH Public Plan Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, EMPLOYEE_MESSAGES.tickFailed) }, { status: 500 })
  }
}

/**
 * POST { today }: clears every tick on the day being worked on. Earlier days, and the tasks
 * themselves, stay.
 * POST { today, action: "start-new-day" }: finishes that day (it moves into the history, still
 * tickable) and opens the next one, empty. Only this moves the day on; midnight never does.
 * POST { today, action: "cancel-day" }: deletes that day, ticks and all, and goes back to the day
 * before it. 409 when there is no earlier day to go back to.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const parsed = DayActionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || EMPLOYEE_MESSAGES.resetFailed }, { status: 400 })
  }
  const { today, action } = parsed.data
  const failed =
    action === "reset" ? EMPLOYEE_MESSAGES.resetFailed : action === "cancel-day" ? EMPLOYEE_MESSAGES.cancelDayFailed : EMPLOYEE_MESSAGES.startDayFailed
  const done = { reset: "Today's ticks cleared", "start-new-day": "New day started", "cancel-day": "Day cancelled" }[action]
  try {
    const { token } = await params
    const result =
      action === "reset"
        ? await resetPublicDay(token, today)
        : action === "cancel-day"
          ? await cancelPublicDay(token, today)
          : await startPublicNewDay(token, today)
    if (result === null) return invalidLink()
    if (result === "already-open") return NextResponse.json({ success: false, message: EMPLOYEE_MESSAGES.dayAlreadyOpen }, { status: 409 })
    if (result === "no-previous") return NextResponse.json({ success: false, message: EMPLOYEE_MESSAGES.noPreviousDay }, { status: 409 })
    return NextResponse.json({ success: true, message: done, data: result }, { headers: noStore })
  } catch (error: unknown) {
    console.error("POST Public Plan Day Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, failed) }, { status: 500 })
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
