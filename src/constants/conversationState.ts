/**
 * Shared by the tools that read a pasted LinkedIn conversation. The state is derived in
 * code from the model's message timeline, never chosen directly by the model.
 */
export const MESSAGE_SENDERS = ["user", "other_person"] as const

export type MessageSender = (typeof MESSAGE_SENDERS)[number]

export const CONVERSATION_STATES = {
  never_replied: "They haven't replied yet",
  replied_then_silent: "They replied before, then went quiet",
  awaiting_user: "Their message is the latest one",
  unclear: "The speakers or order weren't clear",
} as const

export type ConversationState = keyof typeof CONVERSATION_STATES
