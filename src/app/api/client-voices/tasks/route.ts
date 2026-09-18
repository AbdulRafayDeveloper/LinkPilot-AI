import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { TranscriptBatchSchema } from "@/lib/validation/clientVoices"
import { CLIENT_VOICES_MESSAGES } from "@/constants/clientVoices"
import { extractTasks } from "@/services/clientVoices/tasks"
import { saveTaskGroup } from "@/services/clientVoices/records"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest, withSource } from "@/services/modelPriority"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * POST: Turns the batch's transcripts into one list of the work the client asked for.
 *
 * Only text arrives here, and only the list goes back. With no client chosen nothing is written to
 * the database and the batch exists in the page and nowhere else; with a client (and the ids of the
 * voices already kept for it) the list is saved with that client too, so it can be read and edited later.
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

    const { voices, missingVoices, clientId, voiceIds } = parsed.data
    const result = withSource(await runAiRequest(auth.viewer, "client-voices", () => extractTasks({ voices, missingVoices, signal: req.signal })))
    // Kept only when the batch belongs to a client; the voices it was made from point back at it
    const saved = clientId ? await saveTaskGroup(auth.viewer, { clientId, tasks: result.tasks, voiceIds: voiceIds ?? [], missingVoices }) : null
    return NextResponse.json({ success: true, message: "Tasks ready", data: { ...result, savedTasks: saved } })
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
