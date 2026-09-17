import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages"
import { streamTextWithFallback, type ModelProvider } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { searchMeeting, syncMeetingVectors, type MeetingMatch } from "@/services/meetingPlanner/vectors"
import { ANSWER_MAX_TOKENS, CHAT_CONTEXT_MESSAGES, MEETING_CHAT_MESSAGES } from "@/constants/meetingChat"
import { UserFacingError } from "@/lib/errors"
import type { MeetingPlanDetail } from "@/types/meetingPlanner"
import type { MeetingChatMessage } from "@/types/meetingChat"

/**
 * Asking a meeting a question.
 *
 * The meeting's vectors are brought up to date first (services/meetingPlanner/vectors.ts), the
 * question finds the few pieces closest to it, and only those go to the model with the last few
 * messages of the chat. So the whole meeting is never sent, a follow-up still makes sense, and the
 * answer is written as it arrives. When the meeting holds no answer, the model explains the subject
 * itself and says so, keeping it tied to this meeting rather than wandering off.
 */

export interface MeetingAnswer {
  text: string
  provider: ModelProvider
  // What the answer was read from, by label
  sources: string[]
  fromMeeting: boolean
}

interface AskOptions {
  meeting: MeetingPlanDetail
  ownerId: string | null
  question: string
  // The chat so far, oldest first
  history: MeetingChatMessage[]
  signal: AbortSignal
  onToken: (text: string) => void
}

const asContext = (matches: MeetingMatch[]) =>
  matches.map((match, index) => `[${index + 1}] ${match.label}\n${match.text}`).join("\n\n")

export async function askMeeting({ meeting, ownerId, question, history, signal, onToken }: AskOptions): Promise<MeetingAnswer> {
  const { pieces } = await syncMeetingVectors(meeting, ownerId, signal)
  if (pieces === 0) throw new UserFacingError(MEETING_CHAT_MESSAGES.notReady)

  const matches = await searchMeeting(meeting.id, question, signal)
  const system = renderPrompt(await loadPrompt("meeting-chat-system"), {
    MEETING_NAME: meeting.name,
    PERSON_NAME: meeting.personName || "the person",
    MEETING_WHEN: `${meeting.meetingDate} at ${meeting.meetingTime}`,
  })
  const notes =
    matches.length > 0
      ? `Pieces of this meeting, closest to the question first:\n\n${asContext(matches)}`
      : "Nothing saved on this meeting matches the question."

  const messages = [
    new SystemMessage(system),
    ...history
      .slice(-CHAT_CONTEXT_MESSAGES)
      .map((message) => (message.role === "you" ? new HumanMessage(message.text) : new AIMessage(message.text))),
    // The reminder rides with every question, so a chat that already holds answers in another language,
    // or a question written in one, still gets an English answer
    new HumanMessage(`<meeting_notes>\n${notes}\n</meeting_notes>\n\nQuestion: ${question}\n\nWrite your answer in English.`),
  ]

  const { text, provider } = await streamTextWithFallback({ messages, onToken, maxTokens: ANSWER_MAX_TOKENS, signal })
  console.info("💬 Meeting question answered", { meeting: meeting.id, provider, matches: matches.length, characters: text.length })
  return { text: text.trim(), provider, sources: matches.map((match) => match.label), fromMeeting: matches.length > 0 }
}
