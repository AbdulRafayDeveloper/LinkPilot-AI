/**
 * Follow-up type registry. Each type owns an independent, separately stored prompt
 * (default template: src/prompts/follow-up-<id>.md). Adding a type means adding an
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

export function followUpPromptKey(type: FollowUpTypeId): string {
  return `follow_up_prompt:${type}`
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
