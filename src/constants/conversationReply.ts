import { ABOUT_ME_TAB_ID, ABOUT_ME_TAB_LABEL } from "@/constants/outreachTunes"
import { LEAD_SIGNALS_PROMPT_ID, LEAD_SIGNALS_TAB_LABEL } from "@/constants/leadSignals"

/**
 * Reply-tone registry: the owner's recommended tones (2, 3, 5) first, then the rest in stage
 * order. Each tone owns an independent, separately stored prompt (default template:
 * src/prompts/conversation-reply-<id>.md). The tone only steers the reply: the conversation
 * signals are analyzed without it.
 */
export const CONVERSATION_REPLY_TYPES = [
  { id: "validate-share-pattern", label: "Validate + Share Pattern", description: "Stage 2–3 · Top pick" },
  { id: "build-credibility-frame", label: "Build Credibility Frame", description: "Stage 3 · Top pick" },
  { id: "problem-challenge-bridge", label: "Problem-Challenge Bridge", description: "Stage 4 · Top pick" },
  { id: "acknowledge-question", label: "Acknowledge + Question", description: "Stage 1–2" },
  { id: "offer-resource-value", label: "Offer Resource Value", description: "Stage 3–4" },
  { id: "curiosity-close", label: "Curiosity Close", description: "Stage 5" },
] as const

export type ConversationReplyTypeId = (typeof CONVERSATION_REPLY_TYPES)[number]["id"]

export const CONVERSATION_REPLY_TYPE_IDS = CONVERSATION_REPLY_TYPES.map((type) => type.id) as [
  ConversationReplyTypeId,
  ...ConversationReplyTypeId[],
]

// The top recommended tone, selected by default
export const DEFAULT_CONVERSATION_REPLY_TYPE: ConversationReplyTypeId = "validate-share-pattern"

// Prompts stored under this tool's keys: one per tone, plus its own Lead Signals prompt
export type ConversationReplyOwnPromptId = ConversationReplyTypeId | typeof LEAD_SIGNALS_PROMPT_ID

// The shared sender profile is edited as an extra tab next to the tool's own prompts
export { ABOUT_ME_TAB_ID }
export type ConversationReplyPromptId = ConversationReplyOwnPromptId | typeof ABOUT_ME_TAB_ID

export const CONVERSATION_REPLY_PROMPT_TABS: ReadonlyArray<{ id: ConversationReplyPromptId; label: string }> = [
  ...CONVERSATION_REPLY_TYPES.map(({ id, label }) => ({ id, label })),
  { id: LEAD_SIGNALS_PROMPT_ID, label: LEAD_SIGNALS_TAB_LABEL },
  { id: ABOUT_ME_TAB_ID, label: ABOUT_ME_TAB_LABEL },
]

export const CONVERSATION_REPLY_PROMPT_IDS = CONVERSATION_REPLY_PROMPT_TABS.map((tab) => tab.id) as [
  ConversationReplyPromptId,
  ...ConversationReplyPromptId[],
]

export function getReplyTypeLabel(type: ConversationReplyTypeId): string {
  return CONVERSATION_REPLY_TYPES.find((entry) => entry.id === type)?.label ?? type
}

export function getConversationReplyPromptLabel(id: ConversationReplyPromptId): string {
  return CONVERSATION_REPLY_PROMPT_TABS.find((tab) => tab.id === id)?.label ?? id
}

export function conversationReplyPromptKey(id: ConversationReplyOwnPromptId): string {
  return `conversation_reply_prompt:${id}`
}

export const CLIENT_SIZES = ["Small", "Mid-Market", "Large", "Enterprise", "Unknown"] as const
export type ClientSize = (typeof CLIENT_SIZES)[number]

export const RISK_LEVELS = ["Low", "Medium", "High"] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]

export const MAX_KEY_OPPORTUNITIES = 4
export const MAX_KEY_RISKS = 3

export const CONVERSATION_REPLY_CONVERSATION_MAX_LENGTH = 30000
export const CONVERSATION_REPLY_PROFILE_MAX_LENGTH = 30000

export const CONVERSATION_REPLY_MESSAGES = {
  missingConversation: "Please add the previous conversation first.",
  missingType: "Please select a reply tone.",
  conversationTooLong: `The conversation must be under ${CONVERSATION_REPLY_CONVERSATION_MAX_LENGTH.toLocaleString()} characters.`,
  profileTooLong: `Profile information must be under ${CONVERSATION_REPLY_PROFILE_MAX_LENGTH.toLocaleString()} characters.`,
  generationFailed: "We couldn't analyze the conversation right now. Please try again.",
} as const
