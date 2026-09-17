import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { HistoryQuerySchema } from "@/lib/validation/employees"
import { EMPLOYEE_MESSAGES } from "@/constants/employees"
import { getPlanHistory } from "@/services/employees/employees"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/** GET (?before=YYYY-MM-DD): The past days that had tasks, newest first, with when each task was ticked off. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = HistoryQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || EMPLOYEE_MESSAGES.historyFailed }, { status: 400 })
  }
  try {
    const history = await getPlanHistory(auth.viewer, (await params).id, parsed.data.before)
    if (!history) return NextResponse.json({ success: false, message: EMPLOYEE_MESSAGES.notFound }, { status: 404 })
    return NextResponse.json({ success: true, message: "History retrieved", data: history })
  } catch (error: unknown) {
    console.error("GET Employee Plan History Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, EMPLOYEE_MESSAGES.historyFailed) }, { status: 500 })
  }
}
