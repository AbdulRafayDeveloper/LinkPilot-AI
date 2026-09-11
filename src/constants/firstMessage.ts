import {
  ABOUT_ME_TAB_ID,
  DEFAULT_OUTREACH_TUNE,
  OUTREACH_PROMPT_IDS,
  OUTREACH_PROMPT_TABS,
  OUTREACH_TUNE_IDS,
  OUTREACH_TUNES,
  getOutreachTuneLabel,
  type OutreachPromptId,
  type OutreachTuneId,
} from "./outreachTunes"

// Kept as re-exports so existing imports from this module keep working
export { ABOUT_ME_TAB_ID } from "./outreachTunes"
export { LINKEDIN_MESSAGE_MAX_CHARS } from "./linkedinLimits"

/**
 * First Message uses the shared outreach tunes. Each tune owns an independent, separately
 * stored prompt (default template: src/prompts/first-message-<id>.md).
 */
export const FIRST_MESSAGE_TUNES = OUTREACH_TUNES
export type FirstMessageTuneId = OutreachTuneId
export const FIRST_MESSAGE_TUNE_IDS = OUTREACH_TUNE_IDS
export const DEFAULT_FIRST_MESSAGE_TUNE: FirstMessageTuneId = DEFAULT_OUTREACH_TUNE

export type FirstMessagePromptId = OutreachPromptId
export const FIRST_MESSAGE_PROMPT_TABS = OUTREACH_PROMPT_TABS
export const FIRST_MESSAGE_PROMPT_IDS = OUTREACH_PROMPT_IDS
export const getTuneLabel = getOutreachTuneLabel

export function firstMessagePromptKey(tune: FirstMessageTuneId): string {
  return `first_message_prompt:${tune}`
}

export function isAboutMeTab(id: FirstMessagePromptId): id is typeof ABOUT_ME_TAB_ID {
  return id === ABOUT_ME_TAB_ID
}

export const FIRST_MESSAGE_PROFILE_MAX_LENGTH = 30000

export const FIRST_MESSAGE_MESSAGES = {
  missingProfile: "Please add the person's profile information first.",
  missingTune: "Please select a tune.",
  profileTooLong: `Profile information must be under ${FIRST_MESSAGE_PROFILE_MAX_LENGTH.toLocaleString()} characters.`,
  generationFailed: "We couldn't generate the message right now. Please try again.",
} as const
