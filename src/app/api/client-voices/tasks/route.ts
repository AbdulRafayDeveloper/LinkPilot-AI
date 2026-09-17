import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { TranscriptBatchSchema } from "@/lib/validation/clientVoices"
import { CLIENT_VOICES_MESSAGES } from "@/constants/clientVoices"
import { extractTasks } from "@/services/clientVoices/tasks"
import { requireViewer } from "@/services/auth/viewer"
import { withModelOrder } from "@/lib/modelOrder"
import { modelOrderFor } from "@/services/modelPriority"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * POST: Turns the batch's transcripts into one list of the work the client asked for.
 *
 * Only text arrives here, and only the list goes back. Nothing is written to the database and
 * nothing is kept between requests, so the batch exists in the page and nowhere else.
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = TranscriptBatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || CLIENT_VOICES_MESSAGES.noTranscripts },
        { status: 400 }
      )
    }

    const { voices, missingVoices } = parsed.data
    const result = await withModelOrder(await modelOrderFor(auth.viewer, "client-voices"), () => extractTasks({ voices, missingVoices, signal: req.signal }))
    return NextResponse.json({ success: true, message: "Tasks ready", data: result })
  } catch (error: unknown) {
    if (req.signal.aborted) {
      return NextResponse.json({ success: false, message: "Request cancelled" }, { status: 499 })
    }
    console.error("POST Client Voice Tasks Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, CLIENT_VOICES_MESSAGES.tasksFailed) },
      { status: 500 }
    )
  }
}
