import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { TranscriptBatchSchema } from "@/lib/validation/clientVoices"
import { CLIENT_VOICES_MESSAGES } from "@/constants/clientVoices"
import { extractTasks } from "@/services/clientVoices/tasks"
import { clarifyVoicesSafely } from "@/services/clientVoices/clarify"
import { finishBatch, startBatch } from "@/services/clientVoices/batches"
import { keepClearPoints } from "@/services/clientVoices/records"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest, withSource } from "@/services/modelPriority"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * POST: turns the batch's transcripts into one list of the work the client asked for, one list of
 * what they asked about, and a short name for the batch.
 *
 * Only text arrives here, and only those go back. They are then written onto the batch the page
 * started before the run, so a batch is never left without them. A request that names no batch (a
 * page written before batches existed) gets one started for it, so nothing is lost either way.
 *
 * Every voice is also written out **in clear words** beside the lists, in its own call, so a batch
 * whose clear words could not be written still gets everything else (`clarifyVoicesSafely`).
 *
 * **`temporary` is the one way nothing is written at all**: the lists are answered and no batch is
 * started, which is what the page's "use these once" choice asks for. The recordings were already
 * not kept, since the page never offered them to be.
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

    const { voices, missingVoices, clientId, voiceIds, title, temporary } = parsed.data
    // Both read the same transcripts, so they go together rather than one after the other, inside
    // the one request whose provider order and usage they are both counted against
    const { result: both, source } = await runAiRequest(auth.viewer, "client-voices", async () => {
      const [lists, clear] = await Promise.all([
        extractTasks({ voices, missingVoices, signal: req.signal }),
        clarifyVoicesSafely({ voices, signal: req.signal }),
      ])
      return { lists, clear }
    })
    const result = withSource({ result: both.lists, source })
    const clear = both.clear
    // The user's own name for the batch wins over the one written from the voices
    const named = { ...result, clear, title: title || result.title }

    // Nothing is written down at all for a batch the page is running once
    if (temporary) {
      return NextResponse.json({ success: true, message: "Tasks ready", data: { ...named, batchId: null } })
    }

    /**
     * The clear words belong to one voice, so they are written onto the voices themselves rather
     * than onto the batch. A page from before batches carried voice ids simply gets them in the
     * answer and nothing is written, which costs the batch nothing.
     */
    const byVoice = new Map(voices.filter((entry) => entry.voiceId).map((entry) => [entry.voice, entry.voiceId as string]))
    if (byVoice.size > 0 && clear.length > 0) {
      await keepClearPoints(
        auth.viewer,
        clear.filter((entry) => byVoice.has(entry.voice)).map((entry) => ({ id: byVoice.get(entry.voice) as string, points: entry.points }))
      ).catch((error: unknown) => {
        console.error("❌ Could not keep the clear words of a voice:", error instanceof Error ? error.message : error)
        return 0
      })
    }

    // The batch the page started, or one started now for a caller that named none
    const batchId =
      parsed.data.batchId ??
      (await startBatch(auth.viewer, { clientId: clientId ?? "", title, voiceCount: voices.length + missingVoices.length })).id
    // The voices the lists were made from: the ones named one by one, or the plain list a page from before sends
    const kept = voices.map((entry) => entry.voiceId).filter((id): id is string => Boolean(id))
    // Keeping the lists can never cost the user the lists themselves, which are already written
    const saved = await finishBatch(auth.viewer, batchId, {
      tasks: result.tasks,
      questions: result.questions,
      missingVoices: result.missingVoices,
      voiceIds: kept.length > 0 ? kept : (voiceIds ?? []),
      provider: result.provider ?? null,
      providers: result.providers ?? [],
      suggestedTitle: result.title,
    }).catch((error: unknown) => {
      console.error("❌ Could not keep a client voice batch's lists:", error instanceof Error ? error.message : error)
      return null
    })

    return NextResponse.json({ success: true, message: "Tasks ready", data: { ...named, batchId: saved ? batchId : null } })
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
