/**
 * Outreach tunes shared by First Message and InMail. Each module stores its own
 * independent prompt per tune under its own Setting keys; only ids and labels are shared.
 */
export const OUTREACH_TUNES = [
  { id: "direct-pitch", label: "Direct Pitch", description: "Personalized, clear pitch" },
  { id: "just-first-impressive", label: "Just First Impressive", description: "A strong first impression" },
  { id: "relevant-to-me", label: "Relevant to Me", description: "Their work relates to mine" },
  { id: "meeting-collaboration", label: "Meeting / Collaboration", description: "Open a meeting or partnership" },
  { id: "similarity-collaboration", label: "Similarity-Based Collaboration", description: "Build on genuine overlap" },
  { id: "highly-pitched", label: "Highly Pitched", description: "Strong, specific sales pitch" },
  { id: "soft-opportunity", label: "Soft Opportunity", description: "Gently raise an opportunity" },
] as const

export type OutreachTuneId = (typeof OUTREACH_TUNES)[number]["id"]

export const OUTREACH_TUNE_IDS = OUTREACH_TUNES.map((tune) => tune.id) as [OutreachTuneId, ...OutreachTuneId[]]

export const DEFAULT_OUTREACH_TUNE: OutreachTuneId = "just-first-impressive"

export function getOutreachTuneLabel(tune: OutreachTuneId): string {
  return OUTREACH_TUNES.find((entry) => entry.id === tune)?.label ?? tune
}

// The shared sender profile (services/senderProfile.ts) is edited as an extra tab next to tune prompts
export const ABOUT_ME_TAB_ID = "about-me"
export const ABOUT_ME_TAB_LABEL = "About Me (sender)"
export type OutreachPromptId = OutreachTuneId | typeof ABOUT_ME_TAB_ID

export const OUTREACH_PROMPT_TABS: ReadonlyArray<{ id: OutreachPromptId; label: string }> = [
  ...OUTREACH_TUNES.map(({ id, label }) => ({ id, label })),
  { id: ABOUT_ME_TAB_ID, label: ABOUT_ME_TAB_LABEL },
]

export const OUTREACH_PROMPT_IDS = OUTREACH_PROMPT_TABS.map((tab) => tab.id) as [OutreachPromptId, ...OutreachPromptId[]]
