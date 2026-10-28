import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { BUDGET_MESSAGES } from "@/constants/budget"
import { MonthBodySchema, MonthIdSchema } from "@/lib/validation/budget"
import { deleteMonth, getMonth, saveMonth } from "@/services/budget/budget"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

const badMonth = () => NextResponse.json({ success: false, message: BUDGET_MESSAGES.invalidMonth }, { status: 400 })

/** GET: one month as the page should start it; a month nothing is recorded in yet comes back empty. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ month: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const month = MonthIdSchema.safeParse((await params).month)
  if (!month.success) return badMonth()
  try {
    return NextResponse.json({ success: true, message: "Month retrieved", data: await getMonth(auth.viewer, month.data) })
  } catch (error: unknown) {
    console.error("GET Budget Month Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, BUDGET_MESSAGES.loadFailed) }, { status: 500 })
  }
}

/**
 * PUT: the month as it stands on the page, whole (payments, expenses, the fixed and additional
 * distribution), with `confirmed` to confirm the distribution or open the month again. Writing the
 * same month twice lands on the same state, so the page may safely send it again.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ month: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const month = MonthIdSchema.safeParse((await params).month)
  if (!month.success) return badMonth()
  try {
    const parsed = MonthBodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || BUDGET_MESSAGES.invalid }, { status: 400 })
    const saved = await saveMonth(auth.viewer, month.data, parsed.data)
    const message = parsed.data.confirmed === true ? BUDGET_MESSAGES.confirmed : parsed.data.confirmed === false ? BUDGET_MESSAGES.reopened : "Saved."
    return NextResponse.json({ success: true, message, data: saved })
  } catch (error: unknown) {
    console.error("PUT Budget Month Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, BUDGET_MESSAGES.saveFailed) }, { status: 500 })
  }
}

/** DELETE: clears the month; the balances after it follow on their own. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ month: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const month = MonthIdSchema.safeParse((await params).month)
  if (!month.success) return badMonth()
  try {
    await deleteMonth(auth.viewer, month.data)
    return NextResponse.json({ success: true, message: BUDGET_MESSAGES.monthCleared, data: { cleared: true } })
  } catch (error: unknown) {
    console.error("DELETE Budget Month Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, BUDGET_MESSAGES.saveFailed) }, { status: 500 })
  }
}
