import type { AiChatEvent, AiChatMessage } from "@/types/chat"

/** One message of a person's Finance Bot chat, as the page holds it. */
export interface FinanceChatMessage extends AiChatMessage {
  // The sections of My AI Profile an answer was shaped by
  sources: string[]
  fromProfile: boolean
}

export interface FinanceChatHistory {
  messages: FinanceChatMessage[]
  // Whether the person's profile has anything searchable to shape an answer with
  hasProfile: boolean
}

export type FinanceChatEvent = AiChatEvent<FinanceChatMessage>
