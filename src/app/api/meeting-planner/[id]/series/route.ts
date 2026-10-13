import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { MEETING_PLANNER_MESSAGES, RECURRENCE_MAX_OCCURRENCES } from "@/constants/meetingPlanner"
import { extendSeries } from "@/services/meetingPlanner/plans"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

/**
 * How many meetings the series should run for **after this one**. What already follows counts
 * towards it, so the same request sent twice adds nothing the second time; it is wrapped in
 * `withIdempotency` as well, like every route that creates records.
 */
const ExtendSchema = z.object({
  count: z
    .number({ error: MEETING_PLANNER_MESSAGES.badExtendCount })
    .int(MEETING_PLANNER_MESSAGES.badExtendCount)
    .min(1, MEETING_PLANNER_MESSAGES.badExtendCount)
    .max(RECURRENCE_MAX_OCCURRENCES, MEETING_PLANNER_MESSAGES.badExtendCount),
})

/**
 * POST: makes the repeating meeting run for the next `count` meetings after this one, adding only
 * what is missing (see extendSeries). It is how a series is extended from any week of it, not only
 * from its last. A one-off meeting answers 400, since there is no series to extend.
 */
async function handlePost(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = ExtendSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || MEETING_PLANNER_MESSAGES.badExtendCount },
        { status: 400 }
      )
    }

    const result = await extendSeries(auth.viewer, (await params).id, parsed.data.count)
    if (result === "not-found") {
      return NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.notFound }, { status: 404 })
    }
    if (result === "not-a-series") {
      return NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.notASeries }, { status: 400 })
    }
    if (result === "full") {
      return NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.seriesFull }, { status: 400 })
    }
    return NextResponse.json({ success: true, message: MEETING_PLANNER_MESSAGES.seriesExtended, data: result })
  } catch (error: unknown) {
    console.error("POST Meeting Series Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, MEETING_PLANNER_MESSAGES.extendFailed) },
      { status: 500 }
    )
  }
}

export const POST = withIdempotency("meeting-planner-series", handlePost)
