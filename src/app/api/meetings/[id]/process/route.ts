import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { MEETING_MESSAGES } from "@/constants/meetings"
import { resetAnalysis, runAnalysis } from "@/services/meetings/run"

export const dynamic = "force-dynamic"
// One call reads a handful of chunks and then answers; the page calls again while there is more
export const maxDuration = 300

const BodySchema = z.object({ restart: z.boolean().optional() }).catch({ restart: false })

/**
 * POST: Moves one meeting's analysis forward and answers with how far it got. The page keeps
 * calling while `hasMore` is true, so a five hour transcript is read across many short requests
 * instead of one long one, and every part already read is kept if a call is interrupted.
 *
 * `{ "restart": true }` throws away what was read and starts the meeting again, which is what the
 * Re-analyse action uses after the transcript has been edited.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await req.json().catch(() => ({}))
    if (BodySchema.parse(body).restart) {
      const reset = await resetAnalysis(id)
      if (!reset) return NextResponse.json({ success: false, message: MEETING_MESSAGES.notFound }, { status: 404 })
    }

    const state = await runAnalysis(id, { signal: req.signal })
    if (!state) return NextResponse.json({ success: false, message: MEETING_MESSAGES.notFound }, { status: 404 })
    return NextResponse.json({ success: true, message: "Analysis moved on", data: state })
  } catch (error: unknown) {
    if (req.signal.aborted) {
      // The browser went away; what was read is saved, so the next call carries on
      return NextResponse.json({ success: false, message: "Request cancelled" }, { status: 499 })
    }
    console.error("POST Meeting Process Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MEETING_MESSAGES.analysisFailed) }, { status: 500 })
  }
}
