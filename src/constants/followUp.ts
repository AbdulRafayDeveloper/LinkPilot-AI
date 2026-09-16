import { LEAD_SIGNALS_PROMPT_ID, LEAD_SIGNALS_TAB_LABEL } from "./leadSignals"

/**
 * Follow-up type registry. Each type owns an independent, separately stored prompt
 * (prompt record: follow-up-<id> in the prompts collection). Adding a type means adding an
 * entry here plus its default template; the generation pipeline stays unchanged.
 */
export const FOLLOW_UP_TYPES = [
  { id: "non-pitch", label: "Non-Pitch Follow-Up", description: "Reconnect without selling" },
  { id: "pitch", label: "Pitch Follow-Up", description: "Bring up your offer, softly" },
] as const

export type FollowUpTypeId = (typeof FOLLOW_UP_TYPES)[number]["id"]

export const FOLLOW_UP_TYPE_IDS = FOLLOW_UP_TYPES.map((type) => type.id) as [FollowUpTypeId, ...FollowUpTypeId[]]

export function getFollowUpTypeLabel(type: FollowUpTypeId): string {
  return FOLLOW_UP_TYPES.find((entry) => entry.id === type)?.label ?? type
}

// The lead signals have their own editable prompt, independent of the follow-up type
export type FollowUpPromptId = FollowUpTypeId | typeof LEAD_SIGNALS_PROMPT_ID

export const FOLLOW_UP_PROMPT_TABS: ReadonlyArray<{ id: FollowUpPromptId; label: string }> = [
  ...FOLLOW_UP_TYPES.map(({ id, label }) => ({ id, label })),
  { id: LEAD_SIGNALS_PROMPT_ID, label: LEAD_SIGNALS_TAB_LABEL },
]

export const FOLLOW_UP_PROMPT_IDS = FOLLOW_UP_PROMPT_TABS.map((tab) => tab.id) as [FollowUpPromptId, ...FollowUpPromptId[]]

export function getFollowUpPromptLabel(id: FollowUpPromptId): string {
  return FOLLOW_UP_PROMPT_TABS.find((tab) => tab.id === id)?.label ?? id
}

export const CONVERSATION_MAX_LENGTH = 30000
export const FOLLOW_UP_PROFILE_MAX_LENGTH = 30000

export const FOLLOW_UP_MESSAGES = {
  missingConversation: "Please paste your previous conversation first.",
  missingType: "Please select a follow-up type.",
  conversationTooLong: `The conversation must be under ${CONVERSATION_MAX_LENGTH.toLocaleString()} characters.`,
  profileTooLong: `Profile information must be under ${FOLLOW_UP_PROFILE_MAX_LENGTH.toLocaleString()} characters.`,
  generationFailed: "Unable to generate the follow-up message right now. Please try again.",
} as const
