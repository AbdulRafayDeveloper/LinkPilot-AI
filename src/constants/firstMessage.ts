import { ABOUT_ME_TAB_ID, ABOUT_ME_TAB_LABEL } from "./outreachTunes"
import type { OpeningLine } from "@/lib/openingLine"

// Kept as re-exports so existing imports from this module keep working
export { ABOUT_ME_TAB_ID } from "./outreachTunes"
export { LINKEDIN_MESSAGE_MAX_CHARS } from "./linkedinLimits"

/**
 * First Message's own tones, in recommended order (most effective first). Each tone owns
 * an independent, separately stored prompt (prompt record: first-message-<id> in the prompts collection).
 * InMail keeps the shared outreach tunes.
 */
export const FIRST_MESSAGE_TUNES = [
  { id: "curiosity-hook", label: "Curiosity Hook", description: "Recommended · Intrigue, then a question" },
  { id: "value-first", label: "Value First", description: "Share an insight before any ask" },
  { id: "credibility-play", label: "Credibility Play", description: "Specific observation about their work" },
  { id: "problem-solution", label: "Problem-Solution", description: "Name their challenge, focus on them" },
  { id: "soft-consultation", label: "Soft Consultation", description: "Ask for their perspective, no pitch" },
  // Curiosity Hook for someone who engaged with your post or your comment: a thank-you line first, then the hook
  { id: "post-interaction", label: "Post Interaction", description: "Thanks for your post + curiosity hook" },
  { id: "comment-interaction", label: "Comment Interaction", description: "Thanks for your comment + curiosity hook" },
  // Someone who viewed your profile and accepted your connection request: say you noticed, then a soft offer to help
  { id: "viewed-accepted", label: "Viewed + Accepted", description: "Viewed your profile + a soft offer to help" },
] as const

export type FirstMessageTuneId = (typeof FIRST_MESSAGE_TUNES)[number]["id"]

// A first sentence that already thanks them for the post or comment, in whatever words
const RESTATES_THANKS = /\bthank\w*\b.*\b(?:post|comment|interact|engag|like|react|share)/i
// A first sentence that already mentions the profile view or the accepted request, in whatever words
const RESTATES_VIEW = /\b(?:view|viewed|visited|checked out|looked at|stopped by)\b.*\bprofile\b|\baccept\w*\b.*\b(?:connection|request|invit\w*)|\bthank\w*\b.*\bconnect/i

/**
 * The sentence these tones always open with, straight after "Hi <first name>,". The prompt asks
 * for it, and lib/openingLine.ts puts it back in code when a draft or the humanizer's rewrite says it
 * differently, so the message opens exactly this way every time.
 */
export const OPENING_LINES: Partial<Record<FirstMessageTuneId, OpeningLine>> = {
  "post-interaction": { sentence: "thanks for interacting with my recent post.", restates: RESTATES_THANKS },
  "comment-interaction": { sentence: "thanks for interacting with my recent comment.", restates: RESTATES_THANKS },
  "viewed-accepted": {
    sentence: "I noticed you viewed my profile and accepted my connection request.",
    restates: RESTATES_VIEW,
  },
}

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
