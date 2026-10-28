import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { createEventStream } from "@/lib/sse"
import { FINANCE_BOT_MESSAGES, FINANCE_QUESTION_MAX_LENGTH } from "@/constants/financeBot"
import { askFinanceBot } from "@/services/financeBot/chat"
import { clearFinanceChat, getFinanceChat, saveFinanceMessage } from "@/services/financeBot/history"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest } from "@/services/modelPriority"
import type { FinanceChatEvent } from "@/types/financeBot"

export const dynamic = "force-dynamic"
// Searching the profile and writing a roadmap takes longer than a plain request
export const maxDuration = 120

const QuestionSchema = z.object({
  question: z
    .string({ error: FINANCE_BOT_MESSAGES.missingQuestion })
    .trim()
    .min(1, FINANCE_BOT_MESSAGES.missingQuestion)
    .max(FINANCE_QUESTION_MAX_LENGTH, FINANCE_BOT_MESSAGES.questionTooLong),
})

/** GET: the person's chat so far, and whether their profile has anything to shape an answer with. */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    return NextResponse.json({ success: true, message: "Chat retrieved", data: await getFinanceChat(auth.viewer.id) })
  } catch (error: unknown) {
    console.error("GET Finance Bot Chat Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, FINANCE_BOT_MESSAGES.historyFailed) }, { status: 500 })
  }
}

/**
 * POST { question }: answers from the person's own My AI Profile, streaming the answer as it is
 * written (Server-Sent Events). The question and the answer are both kept on their account, so the
 * chat is still there next time and a follow-up knows what came before.
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = QuestionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || FINANCE_BOT_MESSAGES.missingQuestion }, { status: 400 })
  }
  const { viewer } = auth

  return createEventStream<FinanceChatEvent>(async (send) => {
    try {
      const history = (await getFinanceChat(viewer.id)).messages
      await saveFinanceMessage(viewer.id, { role: "you", text: parsed.data.question })
      const { result: answer } = await runAiRequest(viewer, "finance-bot", () =>
        askFinanceBot({
          ownerId: viewer.id,
          personName: viewer.name,
          question: parsed.data.question,
          history,
          signal: req.signal,
          onToken: (text) => send({ status: "TOKEN", text }),
        })
      )
      const saved = await saveFinanceMessage(viewer.id, {
        role: "assistant",
        text: answer.text,
        sources: answer.sources,
        fromProfile: answer.fromProfile,
        provider: answer.provider,
      })
      send({ status: "COMPLETE", message: saved })
    } catch (error: unknown) {
      if (req.signal.aborted) return
      console.error("POST Finance Bot Chat Exception:", error instanceof Error ? error.message : error)
      send({ status: "ERROR", message: toUserFacingMessage(error, FINANCE_BOT_MESSAGES.answerFailed) })
    }
  })
}

/** DELETE: clears the person's chat. Their profile stays exactly as it is. */
export async function DELETE() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    await clearFinanceChat(auth.viewer.id)
    return NextResponse.json({ success: true, message: FINANCE_BOT_MESSAGES.cleared, data: await getFinanceChat(auth.viewer.id) })
  } catch (error: unknown) {
    console.error("DELETE Finance Bot Chat Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, FINANCE_BOT_MESSAGES.clearFailed) }, { status: 500 })
  }
}
