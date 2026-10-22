import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { TranscriptBatchSchema } from "@/lib/validation/clientVoices"
import { CLIENT_VOICES_MESSAGES } from "@/constants/clientVoices"
import { extractTasks } from "@/services/clientVoices/tasks"
import { finishBatch, startBatch } from "@/services/clientVoices/batches"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest, withSource } from "@/services/modelPriority"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * POST: turns the batch's transcripts into one list of the work the client asked for and one list of
 * what they asked about.
 *
 * Only text arrives here, and only the lists go back. They are then written onto the batch the page
 * started before the run, so a batch is never left without them. A request that names no batch (a
 * page written before batches existed) gets one started for it, so nothing is lost either way.
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

    // The batch the page started, or one started now for a caller that named none
    const batchId =
      parsed.data.batchId ??
      (await startBatch(auth.viewer, { clientId: clientId ?? "", voiceCount: voices.length + missingVoices.length })).id
    // Keeping the lists can never cost the user the lists themselves, which are already written
    const saved = await finishBatch(auth.viewer, batchId, {
      tasks: result.tasks,
      questions: result.questions,
      missingVoices: result.missingVoices,
      voiceIds: voiceIds ?? [],
      provider: result.provider ?? null,
      providers: result.providers ?? [],
    }).catch((error: unknown) => {
      console.error("❌ Could not keep a client voice batch's lists:", error instanceof Error ? error.message : error)
      return null
    })

    return NextResponse.json({ success: true, message: "Tasks ready", data: { ...result, batchId: saved ? batchId : null } })
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
