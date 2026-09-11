import {
  DEFAULT_OUTREACH_TUNE,
  OUTREACH_PROMPT_IDS,
  OUTREACH_PROMPT_TABS,
  OUTREACH_TUNE_IDS,
  OUTREACH_TUNES,
  type OutreachPromptId,
  type OutreachTuneId,
} from "./outreachTunes"

/**
 * InMail uses the shared outreach tunes, with its own independent prompt per tune
 * (default template: src/prompts/inmail-<id>.md; Setting key: inmail_prompt:<id>).
 */
export const INMAIL_TUNES = OUTREACH_TUNES
export type InMailTuneId = OutreachTuneId
export const INMAIL_TUNE_IDS = OUTREACH_TUNE_IDS
export const DEFAULT_INMAIL_TUNE: InMailTuneId = DEFAULT_OUTREACH_TUNE

export type InMailPromptId = OutreachPromptId
export const INMAIL_PROMPT_TABS = OUTREACH_PROMPT_TABS
export const INMAIL_PROMPT_IDS = OUTREACH_PROMPT_IDS

export function inmailPromptKey(tune: InMailTuneId): string {
  return `inmail_prompt:${tune}`
}

export const INMAIL_PROFILE_MAX_LENGTH = 30000

export const INMAIL_MESSAGES = {
  missingProfile: "Please add the person's profile information first.",
  missingTune: "Please select a tune.",
  profileTooLong: `Profile information must be under ${INMAIL_PROFILE_MAX_LENGTH.toLocaleString()} characters.`,
  generationFailed: "We couldn't generate the InMail right now. Please try again.",
} as const
