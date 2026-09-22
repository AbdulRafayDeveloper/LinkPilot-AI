import { ABOUT_ME_TAB_ID, ABOUT_ME_TAB_LABEL } from "./outreachTunes"
import { RESTATES_THANKS, RESTATES_VIEW, type OpeningLine } from "@/lib/openingLine"

/**
 * InMail's own tones, in recommended order (most effective first). Each tone owns an
 * independent prompt that writes both the subject and the message (prompt record:
 * inmail-<id> in the prompts collection).
 */
export const INMAIL_TUNES = [
  { id: "trigger-event", label: "Trigger Event", description: "Recommended · Recent hire, funding or role" },
  { id: "personalized-observation", label: "Personalized Observation", description: "Their post or achievement" },
  { id: "credibility-play", label: "Credibility Play", description: "Achievement + proof" },
  { id: "curiosity-hook", label: "Curiosity Hook", description: "Data, intrigue or a pattern" },
  { id: "pitch", label: "Pitch", description: "Your matching work + a clear offer" },
  // For someone who engaged with your post or your comment: a thank-you line first, then a curiosity hook
  { id: "post-interaction", label: "Post Interaction", description: "Thanks for your post + curiosity hook" },
  { id: "comment-interaction", label: "Comment Interaction", description: "Thanks for your comment + curiosity hook" },
  // Someone who viewed your profile and accepted your connection request: say you noticed, then a soft offer to help
  { id: "viewed-accepted", label: "Viewed + Accepted", description: "Viewed your profile + a soft offer to help" },
] as const

export type InMailTuneId = (typeof INMAIL_TUNES)[number]["id"]

export const INMAIL_TUNE_IDS = INMAIL_TUNES.map((tune) => tune.id) as [InMailTuneId, ...InMailTuneId[]]

/**
 * The sentence these tones' messages always open with, straight after "Hi <first name>,", the same
 * sentences First Message's tones of the same name use. The prompt asks for it, and lib/openingLine.ts
 * puts it back in code when a draft or the humanizer's rewrite says it differently.
 */
export const OPENING_LINES: Partial<Record<InMailTuneId, OpeningLine>> = {
  "post-interaction": { sentence: "thanks for interacting with my recent post.", restates: RESTATES_THANKS },
  "comment-interaction": { sentence: "thanks for interacting with my recent comment.", restates: RESTATES_THANKS },
  "viewed-accepted": {
    sentence: "I noticed you viewed my profile and accepted my connection request.",
    restates: RESTATES_VIEW,
  },
}

// The recommended first choice, selected by default
export const DEFAULT_INMAIL_TUNE: InMailTuneId = "trigger-event"

export type InMailPromptId = InMailTuneId | typeof ABOUT_ME_TAB_ID

export const INMAIL_PROMPT_TABS: ReadonlyArray<{ id: InMailPromptId; label: string }> = [
  ...INMAIL_TUNES.map(({ id, label }) => ({ id, label })),
  { id: ABOUT_ME_TAB_ID, label: ABOUT_ME_TAB_LABEL },
]

export const INMAIL_PROMPT_IDS = INMAIL_PROMPT_TABS.map((tab) => tab.id) as [InMailPromptId, ...InMailPromptId[]]

export function getInMailTuneLabel(tune: InMailTuneId): string {
  return INMAIL_TUNES.find((entry) => entry.id === tune)?.label ?? tune
}

export const INMAIL_PROFILE_MAX_LENGTH = 30000

export const INMAIL_MESSAGES = {
  missingProfile: "Please add the person's profile information first.",
  missingTune: "Please select a tone.",
  profileTooLong: `Profile information must be under ${INMAIL_PROFILE_MAX_LENGTH.toLocaleString()} characters.`,
  generationFailed: "We couldn't generate the InMail right now. Please try again.",
} as const
