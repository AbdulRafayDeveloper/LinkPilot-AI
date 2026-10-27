import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages"
import { streamTextWithFallback, type ModelProvider } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { loadPromptBook } from "@/services/promptBook"
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
  // Every word besides the chat's system prompt (each piece's labels included) is the instructions prompt's
  const book = await loadPromptBook("meetings-instructions")
  const { pieces } = await syncMeetingVectors(meeting.id, notesChunks(meeting, book), ownerId, signal)
  if (pieces === 0) throw new UserFacingError(MEETING_CHAT_MESSAGES.notesNotReady)

  const matches = await searchMeeting(meeting.id, question, signal)
  const system = renderPrompt(await loadPrompt("meeting-notes-chat-system"), {
    MEETING_NAME: meeting.title,
    MEETING_WHEN: meeting.createdAt.slice(0, 10),
    // The analysis may be missing or out of date, and an answer must not pretend otherwise
    ANALYSIS_STATE: book.text(meeting.analysis ? (meeting.isAnalysisStale ? "chat.analysis.stale" : "chat.analysis.current") : "chat.analysis.none"),
  })
  const notes = matches.length > 0 ? `${book.text("chat.pieces-heading")}\n\n${asContext(matches)}` : book.text("chat.nothing-matches")

  const messages = [
    new SystemMessage(system),
    ...history
      .slice(-CHAT_CONTEXT_MESSAGES)
      .map((message) => (message.role === "you" ? new HumanMessage(message.text) : new AIMessage(message.text))),
    // The reminder rides with every question, so a meeting held in another language still gets an English answer
    new HumanMessage(book.text("chat.question", { notes, question })),
  ]

  const { text, provider } = await streamTextWithFallback({ messages, onToken, maxTokens: ANSWER_MAX_TOKENS, signal })
  console.info("💬 Meeting notes question answered", { meeting: meeting.id, provider, matches: matches.length, characters: text.length })
  return { text: text.trim(), provider, sources: matches.map((match) => match.label), fromMeeting: matches.length > 0 }
}
