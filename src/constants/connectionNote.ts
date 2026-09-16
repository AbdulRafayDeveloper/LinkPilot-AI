/**
 * Tone registry. Each tone owns an independent, separately stored prompt
 * (prompt record: connection-note-<id> in the prompts collection). Adding a tone means adding
 * an entry here plus its default template; the generation pipeline stays unchanged.
 * The order here is the order of the tone cards and the Update Prompt tabs.
 */
export const CONNECTION_NOTE_TONES = [
  { id: "professional", label: "Professional", description: "Polished and respectful" },
  { id: "impressive", label: "Impressive", description: "Distinctive and memorable" },
  { id: "direct", label: "Direct", description: "Short and to the point" },
  { id: "professional-pitch", label: "Professional + Pitch", description: "Adds your value, softly" },
  // For a decision maker whose company just raised money: congratulate, show the fit, offer to help
  { id: "recently-funded", label: "Recently Funded", description: "Congrats + how you can help" },
  // For a decision maker at a growing startup that is hiring: your matching expertise, portfolio and a short call
  { id: "hiring-startup", label: "Hiring Startup", description: "Your fit + portfolio + a call" },
] as const

export type ConnectionNoteToneId = (typeof CONNECTION_NOTE_TONES)[number]["id"]

// Preselected when the page opens; the user can pick another tone
export const DEFAULT_CONNECTION_NOTE_TONE: ConnectionNoteToneId = "professional"

export const CONNECTION_NOTE_TONE_IDS = CONNECTION_NOTE_TONES.map((tone) => tone.id) as [
  ConnectionNoteToneId,
  ...ConnectionNoteToneId[],
]

/**
 * Tones about one company's news. They show a Company name field, and the name the user types
 * is taken as the company with that news (it raised funding, or it is hiring), even when the
 * pasted profile doesn't say so. Notes in these tones open with "Hi" and the first name.
 */
export interface CompanyTone {
  news: "funding" | "hiring"
  fieldLabel: string
  hint: string
}

export const COMPANY_TONES: Partial<Record<ConnectionNoteToneId, CompanyTone>> = {
  "recently-funded": {
    news: "funding",
    fieldLabel: "Company that raised funding",
    hint: "The note congratulates this company on its new funding.",
  },
  "hiring-startup": {
    news: "hiring",
    fieldLabel: "Company that is hiring",
    hint: "The note speaks to this company's hiring.",
  },
}

export const COMPANY_NAME_MAX_LENGTH = 100

export function getToneLabel(tone: ConnectionNoteToneId): string {
  return CONNECTION_NOTE_TONES.find((entry) => entry.id === tone)?.label ?? tone
}

// LinkedIn's maximum length for a connection request note
export const CONNECTION_NOTE_MAX_CHARS = 300
export const PROFILE_DATA_MAX_LENGTH = 30000

export const CONNECTION_NOTE_MESSAGES = {
  missingProfile: "Please paste the LinkedIn profile data first.",
  missingTone: "Please select a tone.",
  profileTooLong: `Profile data must be under ${PROFILE_DATA_MAX_LENGTH.toLocaleString()} characters.`,
  companyTooLong: `The company name must be under ${COMPANY_NAME_MAX_LENGTH} characters.`,
  generationFailed: "Unable to generate the connection note right now. Please try again.",
} as const
