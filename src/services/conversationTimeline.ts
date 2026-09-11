import { z } from "zod"
import { MESSAGE_SENDERS, type ConversationState, type MessageSender } from "@/constants/conversationState"
import { loadPrompt } from "@/services/prompts"
import type { ConversationParties } from "@/types/conversation"

/**
 * Structured-output fields that make the model name both people and list every message
 * with its sender before it writes or scores anything. Spread them into a tool's schema.
 */
export const conversationPeopleFields = {
  user_name: z
    .string()
    .nullable()
    .describe(
      "Name of the user (the person you work for) as shown in the conversation, e.g. as the sender of their messages or as the name the other person greets. Null if not shown"
    ),
  other_person_name: z
    .string()
    .nullable()
    .describe(
      "First name of the other person, never the user: the sender of the other person's messages, or from the profile. Null if unknown"
    ),
  timeline: z
    .array(
      z.object({
        sender: z.enum(MESSAGE_SENDERS),
        sender_name: z
          .string()
          .nullable()
          .describe("The sender's name exactly as shown on this message (e.g. its header line), or null if not shown"),
        gist: z.string().describe("A few words on what this message says or asks"),
      })
    )
    .describe("Every message in the conversation in chronological order, oldest first, one entry per message"),
}

interface ConversationPeopleOutput {
  user_name: string | null
  other_person_name: string | null
  timeline: ReadonlyArray<{ sender: MessageSender; sender_name: string | null; gist: string }>
}

/**
 * Who spoke last and whether the other person ever replied come from the timeline, not
 * from asking the model directly, which it gets wrong far more often.
 */
export function deriveConversationState(timeline: ConversationPeopleOutput["timeline"]): ConversationState {
  const lastMessage = timeline.at(-1)
  if (!lastMessage) return "unclear"
  if (lastMessage.sender === "other_person") return "awaiting_user"
  return timeline.some((entry) => entry.sender === "other_person") ? "replied_then_silent" : "never_replied"
}

function senderNameFor(timeline: ConversationPeopleOutput["timeline"], sender: MessageSender): string | null {
  return timeline.find((entry) => entry.sender === sender && entry.sender_name?.trim())?.sender_name?.trim() ?? null
}

/**
 * Names come from the sender shown on each timeline entry when the conversation shows
 * them, because the model mixes up the standalone name fields with the greeted name.
 * The standalone fields cover conversations pasted without sender names.
 */
export function toConversationParties(output: ConversationPeopleOutput): ConversationParties {
  const otherPersonName = senderNameFor(output.timeline, "other_person")?.split(/\s+/)[0]
  return {
    state: deriveConversationState(output.timeline),
    userName: senderNameFor(output.timeline, "user") ?? (output.user_name?.trim() || null),
    otherPersonName: otherPersonName || output.other_person_name?.trim() || null,
  }
}

/**
 * Shared rules for reading a pasted conversation, inserted into each tool's system
 * prompt at {{CONVERSATION_READING_RULES}}.
 */
export function loadConversationReadingRules(): string {
  return loadPrompt("conversation-reading")
}
