"use client"

import React from "react"
import { MessageSquare } from "lucide-react"
import { AiChatPanel } from "@/components/ui/AiChatPanel"
import { MEETING_CHAT_SURFACES, QUESTION_MAX_LENGTH, type MeetingChatSurfaceId } from "@/constants/meetingChat"
import type { MeetingChatHistory, MeetingChatMessage } from "@/types/meetingChat"

const readHistory = (history: MeetingChatHistory) => ({ messages: history.messages, isReady: history.pieces > 0 })

const questionMessage = (text: string): MeetingChatMessage => ({
  id: `you-${Date.now()}`,
  role: "you",
  text,
  sources: [],
  fromMeeting: false,
  provider: null,
  createdAt: new Date().toISOString(),
})

const describeAnswer = (message: MeetingChatMessage) =>
  message.fromMeeting ? `Read from: ${message.sources.slice(0, 2).join(", ")}` : "Not saved on this meeting, explained for you"

/**
 * Ask this meeting: a chat that answers from the meeting's own vectors. It serves both meetings, one
 * being prepared for and one that has already happened; everything that differs between them (where
 * the chat lives, which module reads the speech, the words on the page) comes from
 * MEETING_CHAT_SURFACES, and the chat itself is the shared AiChatPanel.
 */
export const MeetingChatPanel: React.FC<{ surface: MeetingChatSurfaceId; meetingId: string; subject: string }> = ({ surface, meetingId, subject }) => {
  const chatFor = MEETING_CHAT_SURFACES[surface]
  return (
    <AiChatPanel<MeetingChatMessage, MeetingChatHistory>
      endpoint={chatFor.endpoint(meetingId)}
      transcribeFor={chatFor.transcribeFor}
      title="Ask this meeting"
      icon={MessageSquare}
      subtitle={chatFor.subtitle(subject)}
      readHistory={readHistory}
      questionMessage={questionMessage}
      describeAnswer={describeAnswer}
      emptyText={chatFor.empty}
      notReadyText={chatFor.notReady}
      pendingText="Reading the meeting..."
      placeholder="Ask anything about this meeting..."
      inputLabel="Your question about this meeting"
      clearDescription={chatFor.clearDescription}
      maxQuestionLength={QUESTION_MAX_LENGTH}
    />
  )
}
