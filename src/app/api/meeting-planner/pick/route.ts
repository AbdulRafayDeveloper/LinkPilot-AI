import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PlanPickQuerySchema } from "@/lib/validation/meeting"
import { MEETING_PLAN_LINK_MESSAGES } from "@/constants/meetings"
import { listPlanGroups, listPlanOccurrences } from "@/services/meetingPlanner/pickPlans"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: the calendar as something to pick one meeting out of, for linking a record to the meeting it
 * was (`components/meetings/LinkToPlanDialog`).
 *
 * Without `series` it answers the meetings grouped by name, so a repeating meeting is one row
 * however many dates it holds; with `series` it answers that one meeting's dates. Both are paged,
 * filtered and searched in the database, so the whole calendar is reachable rather than the three
 * months the picker used to read.
 *
 * It sits under `/api/meeting-planner`, so an account without the planner has nothing to link to and
 * is refused here by the feature gate, exactly as it is on the planner's own pages.
 */
export async function GET(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = PlanPickQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || MEETING_PLAN_LINK_MESSAGES.linkFailed }, { status: 400 })
  }
  const { today, search, when, repeat, month, page, series } = parsed.data
  try {
    const data = series
      ? await listPlanOccurrences(auth.viewer, series, { today, when, month, page })
      : await listPlanGroups(auth.viewer, { today, search, when, repeat, month, page })
    return NextResponse.json({ success: true, message: "Planned meetings retrieved", data })
  } catch (error: unknown) {
    console.error("GET Meeting Plan Pick Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MEETING_PLAN_LINK_MESSAGES.linkFailed) }, { status: 500 })
  }
}
