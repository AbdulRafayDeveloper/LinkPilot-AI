/**
 * The chat on one meeting, as the page holds it. An answer says what it was read from, so the user
 * can tell an answer taken from the meeting from one the model explained itself.
 */
export interface MeetingChatMessage {
  id: string
  role: "you" | "assistant"
  text: string
  sources: string[]
  fromMeeting: boolean
  provider: string | null
  createdAt: string
}

export interface MeetingChatHistory {
  messages: MeetingChatMessage[]
  // How many pieces of this meeting are searchable; 0 means there is nothing to answer from yet
  pieces: number
}

export type MeetingChatEvent =
  | { status: "TOKEN"; text: string }
  | { status: "COMPLETE"; message: MeetingChatMessage }
  | { status: "ERROR"; message: string }
