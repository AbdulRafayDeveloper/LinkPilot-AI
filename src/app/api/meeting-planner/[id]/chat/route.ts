import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { createEventStream } from "@/lib/sse"
import { MEETING_PLANNER_MESSAGES } from "@/constants/meetingPlanner"
import { MEETING_CHAT_MESSAGES, QUESTION_MAX_LENGTH } from "@/constants/meetingChat"
import { getMeeting } from "@/services/meetingPlanner/plans"
import { askMeeting } from "@/services/meetingPlanner/chat"
import { clearMeetingChat, getMeetingChat, saveChatMessage } from "@/services/meetingPlanner/chatHistory"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest } from "@/services/modelPriority"
import type { MeetingChatEvent } from "@/types/meetingChat"

export const dynamic = "force-dynamic"
// Bringing the meeting's vectors up to date and writing an answer takes longer than a plain request
export const maxDuration = 300

const QuestionSchema = z.object({
  question: z
    .string({ error: MEETING_CHAT_MESSAGES.missingQuestion })
    .trim()
    .min(1, MEETING_CHAT_MESSAGES.missingQuestion)
    .max(QUESTION_MAX_LENGTH, MEETING_CHAT_MESSAGES.questionTooLong),
})

type RouteContext = { params: Promise<{ id: string }> }

/** GET: the chat so far on this meeting, and how many pieces of it can be searched. */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const { id } = await params
  try {
    if (!(await getMeeting(auth.viewer, id))) {
      return NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.notFound }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: "Chat retrieved", data: await getMeetingChat(id) })
  } catch (error: unknown) {
    console.error("GET Meeting Chat Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MEETING_CHAT_MESSAGES.historyFailed) }, { status: 500 })
  }
}

/**
 * POST { question }: answers a question about this meeting from the meeting's own vectors, streaming
 * the answer as it is written (Server-Sent Events). The question and the answer are both kept, so the
 * chat is still there next time and a follow-up knows what came before.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const { id } = await params
  const parsed = QuestionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || MEETING_CHAT_MESSAGES.missingQuestion }, { status: 400 })
  }
  const meeting = await getMeeting(auth.viewer, id).catch(() => null)
  if (!meeting) return NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.notFound }, { status: 404 })

  return createEventStream<MeetingChatEvent>(async (send) => {
    try {
      const history = (await getMeetingChat(id)).messages
      await saveChatMessage(id, auth.viewer.id, { role: "you", text: parsed.data.question })
      const { result: answer } = await runAiRequest(auth.viewer, "meeting-planner", () =>
        askMeeting({
          meeting,
          ownerId: auth.viewer.id,
          question: parsed.data.question,
          history,
          signal: req.signal,
          onToken: (text) => send({ status: "TOKEN", text }),
        })
      )
      const saved = await saveChatMessage(id, auth.viewer.id, {
        role: "assistant",
        text: answer.text,
        sources: answer.sources,
        fromMeeting: answer.fromMeeting,
        provider: answer.provider,
      })
      send({ status: "COMPLETE", message: saved })
    } catch (error: unknown) {
      if (req.signal.aborted) return
      console.error("POST Meeting Chat Exception:", error instanceof Error ? error.message : error)
      send({ status: "ERROR", message: toUserFacingMessage(error, MEETING_CHAT_MESSAGES.answerFailed) })
    }
  })
}

/** DELETE: clears this meeting's chat. The meeting and what it is searched from stay as they are. */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const { id } = await params
  try {
    if (!(await getMeeting(auth.viewer, id))) {
      return NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.notFound }, { status: 404 })
    }
    await clearMeetingChat(id)
    return NextResponse.json({ success: true, message: MEETING_CHAT_MESSAGES.cleared, data: await getMeetingChat(id) })
  } catch (error: unknown) {
    console.error("DELETE Meeting Chat Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MEETING_CHAT_MESSAGES.clearFailed) }, { status: 500 })
  }
}
