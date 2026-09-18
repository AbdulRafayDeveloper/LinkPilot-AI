import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages"
import { streamTextWithFallback, type ModelProvider } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { searchMeeting, syncMeetingVectors, type MeetingMatch } from "@/services/meetingPlanner/vectors"
import { notesChunks } from "@/lib/meetingChunks"
import { ANSWER_MAX_TOKENS, CHAT_CONTEXT_MESSAGES, MEETING_CHAT_MESSAGES } from "@/constants/meetingChat"
import { UserFacingError } from "@/lib/errors"
import type { Meeting } from "@/types/meetings"
import type { MeetingChatMessage } from "@/types/meetingChat"

/**
 * Asking a meeting that has already happened.
 *
 * The same shape as the meeting planner's chat (services/meetingPlanner/chat.ts) and the same vector
 * store, with one difference that matters: what the question is answered from is the transcript
 * exactly as it was pasted plus the analysis built from it, not a preparation written in advance.
 * The transcript is cut up too, not only the analysis, because the analysis is a summary and a
 * question about what someone actually said can only be answered from the words themselves.
 *
 * The whole meeting is never sent: the question finds the few pieces closest to it, and only those
 * go to the model with the last few messages of the chat, so a five-hour transcript costs the same
 * per question as a short one.
 */

export interface MeetingNotesAnswer {
  text: string
  provider: ModelProvider
  // What the answer was read from, by label
  sources: string[]
  fromMeeting: boolean
}

interface AskOptions {
  meeting: Meeting
  ownerId: string | null
  question: string
  // The chat so far, oldest first
  history: MeetingChatMessage[]
  signal: AbortSignal
  onToken: (text: string) => void
}

const asContext = (matches: MeetingMatch[]) =>
  matches.map((match, index) => `[${index + 1}] ${match.label}\n${match.text}`).join("\n\n")

export async function askMeetingNotes({ meeting, ownerId, question, history, signal, onToken }: AskOptions): Promise<MeetingNotesAnswer> {
  const { pieces } = await syncMeetingVectors(meeting.id, notesChunks(meeting), ownerId, signal)
  if (pieces === 0) throw new UserFacingError(MEETING_CHAT_MESSAGES.notesNotReady)

  const matches = await searchMeeting(meeting.id, question, signal)
  const system = renderPrompt(await loadPrompt("meeting-notes-chat-system"), {
    MEETING_NAME: meeting.title,
    MEETING_WHEN: meeting.createdAt.slice(0, 10),
    // The analysis may be missing or out of date, and an answer must not pretend otherwise
    ANALYSIS_STATE: meeting.analysis
      ? meeting.isAnalysisStale
        ? "The analysis was built from an earlier version of this transcript, so trust the transcript itself where they disagree."
        : "The analysis is up to date with the transcript."
      : "This meeting has not been analysed yet, so only the transcript is available.",
  })
  const notes =
    matches.length > 0
      ? `Pieces of this meeting, closest to the question first:\n\n${asContext(matches)}`
      : "Nothing in this meeting's notes matches the question."

  const messages = [
    new SystemMessage(system),
    ...history
      .slice(-CHAT_CONTEXT_MESSAGES)
      .map((message) => (message.role === "you" ? new HumanMessage(message.text) : new AIMessage(message.text))),
    // The reminder rides with every question, so a meeting held in another language still gets an English answer
    new HumanMessage(`<meeting_notes>\n${notes}\n</meeting_notes>\n\nQuestion: ${question}\n\nWrite your answer in English.`),
  ]

  const { text, provider } = await streamTextWithFallback({ messages, onToken, maxTokens: ANSWER_MAX_TOKENS, signal })
  console.info("💬 Meeting notes question answered", { meeting: meeting.id, provider, matches: matches.length, characters: text.length })
  return { text: text.trim(), provider, sources: matches.map((match) => match.label), fromMeeting: matches.length > 0 }
}
