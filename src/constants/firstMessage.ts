import { ABOUT_ME_TAB_ID, ABOUT_ME_TAB_LABEL } from "./outreachTunes"

// Kept as re-exports so existing imports from this module keep working
export { ABOUT_ME_TAB_ID } from "./outreachTunes"
export { LINKEDIN_MESSAGE_MAX_CHARS } from "./linkedinLimits"

/**
 * First Message's own tones, in recommended order (most effective first). Each tone owns
 * an independent, separately stored prompt (default template: src/prompts/first-message-<id>.md).
 * InMail keeps the shared outreach tunes.
 */
export const FIRST_MESSAGE_TUNES = [
  { id: "curiosity-hook", label: "Curiosity Hook", description: "Recommended · Intrigue, then a question" },
  { id: "value-first", label: "Value First", description: "Share an insight before any ask" },
  { id: "credibility-play", label: "Credibility Play", description: "Specific observation about their work" },
  { id: "problem-solution", label: "Problem-Solution", description: "Name their challenge, focus on them" },
  { id: "soft-consultation", label: "Soft Consultation", description: "Ask for their perspective, no pitch" },
] as const

export type FirstMessageTuneId = (typeof FIRST_MESSAGE_TUNES)[number]["id"]

export const FIRST_MESSAGE_TUNE_IDS = FIRST_MESSAGE_TUNES.map((tune) => tune.id) as [
  FirstMessageTuneId,
  ...FirstMessageTuneId[],
]

// The recommended first choice, selected by default
export const DEFAULT_FIRST_MESSAGE_TUNE: FirstMessageTuneId = "curiosity-hook"

export type FirstMessagePromptId = FirstMessageTuneId | typeof ABOUT_ME_TAB_ID

export const FIRST_MESSAGE_PROMPT_TABS: ReadonlyArray<{ id: FirstMessagePromptId; label: string }> = [
  ...FIRST_MESSAGE_TUNES.map(({ id, label }) => ({ id, label })),
  { id: ABOUT_ME_TAB_ID, label: ABOUT_ME_TAB_LABEL },
]

export const FIRST_MESSAGE_PROMPT_IDS = FIRST_MESSAGE_PROMPT_TABS.map((tab) => tab.id) as [
  FirstMessagePromptId,
  ...FirstMessagePromptId[],
]

export function getTuneLabel(tune: FirstMessageTuneId): string {
  return FIRST_MESSAGE_TUNES.find((entry) => entry.id === tune)?.label ?? tune
}

export function firstMessagePromptKey(tune: FirstMessageTuneId): string {
  return `first_message_prompt:${tune}`
}

export function isAboutMeTab(id: FirstMessagePromptId): id is typeof ABOUT_ME_TAB_ID {
  return id === ABOUT_ME_TAB_ID
}

export const FIRST_MESSAGE_PROFILE_MAX_LENGTH = 30000

export const FIRST_MESSAGE_MESSAGES = {
  missingProfile: "Please add the person's profile information first.",
  missingTune: "Please select a tone.",
  profileTooLong: `Profile information must be under ${FIRST_MESSAGE_PROFILE_MAX_LENGTH.toLocaleString()} characters.`,
  generationFailed: "We couldn't generate the message right now. Please try again.",
} as const
