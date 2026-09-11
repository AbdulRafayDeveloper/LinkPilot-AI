import { ABOUT_ME_TAB_ID } from "@/constants/outreachTunes"

/**
 * Reply-type registry. Each type owns an independent, separately stored prompt
 * (default template: src/prompts/conversation-reply-<id>.md). The reply type only steers
 * the reply: the conversation signals are analyzed without it.
 */
export const CONVERSATION_REPLY_TYPES = [
  { id: "pitch-now", label: "Pitch Now", description: "Move toward a relevant offer" },
  { id: "continue-conversation", label: "Continue Conversation — No Pitch", description: "Keep it going, no selling" },
  { id: "warm-toward-pitch", label: "Warm Toward Pitch", description: "Build a bridge to a future pitch" },
  { id: "offer-help", label: "Offer Help", description: "Offer something genuinely useful" },
  { id: "move-toward-collaboration", label: "Move Toward Collaboration", description: "Explore working together" },
] as const

export type ConversationReplyTypeId = (typeof CONVERSATION_REPLY_TYPES)[number]["id"]

export const CONVERSATION_REPLY_TYPE_IDS = CONVERSATION_REPLY_TYPES.map((type) => type.id) as [
  ConversationReplyTypeId,
  ...ConversationReplyTypeId[],
]

// The safest conversational default
export const DEFAULT_CONVERSATION_REPLY_TYPE: ConversationReplyTypeId = "continue-conversation"

// The shared sender profile is edited as an extra tab next to the reply-type prompts
export { ABOUT_ME_TAB_ID }
export type ConversationReplyPromptId = ConversationReplyTypeId | typeof ABOUT_ME_TAB_ID

export const CONVERSATION_REPLY_PROMPT_TABS: ReadonlyArray<{ id: ConversationReplyPromptId; label: string }> = [
  ...CONVERSATION_REPLY_TYPES.map(({ id, label }) => ({ id, label })),
  { id: ABOUT_ME_TAB_ID, label: "About Me (sender)" },
]

export const CONVERSATION_REPLY_PROMPT_IDS = CONVERSATION_REPLY_PROMPT_TABS.map((tab) => tab.id) as [
  ConversationReplyPromptId,
  ...ConversationReplyPromptId[],
]

export function getReplyTypeLabel(type: ConversationReplyTypeId): string {
  return CONVERSATION_REPLY_TYPES.find((entry) => entry.id === type)?.label ?? type
}

export function conversationReplyPromptKey(type: ConversationReplyTypeId): string {
  return `conversation_reply_prompt:${type}`
}

export const CLIENT_SIZES = ["Small", "Mid-Market", "Large", "Enterprise", "Unknown"] as const
export type ClientSize = (typeof CLIENT_SIZES)[number]

export const RISK_LEVELS = ["Low", "Medium", "High"] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]

/**
 * Score interpretation shared by the analysis prompt and the UI, highest band first.
 */
export const SCORE_BANDS = [
  { min: 81, label: "Very strong" },
  { min: 61, label: "Strong" },
  { min: 41, label: "Moderate" },
  { min: 21, label: "Low" },
  { min: 0, label: "Very weak" },
] as const

export function getScoreBand(score: number): (typeof SCORE_BANDS)[number] {
  return SCORE_BANDS.find((band) => score >= band.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1]
}

export const MAX_KEY_OPPORTUNITIES = 4
export const MAX_KEY_RISKS = 3

export const CONVERSATION_REPLY_CONVERSATION_MAX_LENGTH = 30000
export const CONVERSATION_REPLY_PROFILE_MAX_LENGTH = 30000

export const CONVERSATION_REPLY_MESSAGES = {
  missingConversation: "Please add the previous conversation first.",
  missingType: "Please select a reply type.",
  conversationTooLong: `The conversation must be under ${CONVERSATION_REPLY_CONVERSATION_MAX_LENGTH.toLocaleString()} characters.`,
  profileTooLong: `Profile information must be under ${CONVERSATION_REPLY_PROFILE_MAX_LENGTH.toLocaleString()} characters.`,
  generationFailed: "We couldn't analyze the conversation right now. Please try again.",
} as const
