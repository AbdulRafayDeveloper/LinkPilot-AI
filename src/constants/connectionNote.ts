/**
 * Tone registry. Each tone owns an independent, separately stored prompt
 * (default template: src/prompts/connection-note-<id>.md). Adding a tone means adding
 * an entry here plus its default template; the generation pipeline stays unchanged.
 * The order here is the order of the tone cards and the Update Prompt tabs.
 */
export const CONNECTION_NOTE_TONES = [
  { id: "professional", label: "Professional", description: "Polished and respectful" },
  { id: "impressive", label: "Impressive", description: "Distinctive and memorable" },
  { id: "direct", label: "Direct", description: "Short and to the point" },
  { id: "professional-pitch", label: "Professional + Pitch", description: "Adds your value, softly" },
] as const

export type ConnectionNoteToneId = (typeof CONNECTION_NOTE_TONES)[number]["id"]

// Preselected when the page opens; the user can pick another tone
export const DEFAULT_CONNECTION_NOTE_TONE: ConnectionNoteToneId = "professional"

export const CONNECTION_NOTE_TONE_IDS = CONNECTION_NOTE_TONES.map((tone) => tone.id) as [
  ConnectionNoteToneId,
  ...ConnectionNoteToneId[],
]

export function getToneLabel(tone: ConnectionNoteToneId): string {
  return CONNECTION_NOTE_TONES.find((entry) => entry.id === tone)?.label ?? tone
}

export function connectionNotePromptKey(tone: ConnectionNoteToneId): string {
  return `connection_note_prompt:${tone}`
}

// LinkedIn's maximum length for a connection request note
export const CONNECTION_NOTE_MAX_CHARS = 300
export const PROFILE_DATA_MAX_LENGTH = 30000

export const CONNECTION_NOTE_MESSAGES = {
  missingProfile: "Please paste the LinkedIn profile data first.",
  missingTone: "Please select a tone.",
  profileTooLong: `Profile data must be under ${PROFILE_DATA_MAX_LENGTH.toLocaleString()} characters.`,
  generationFailed: "Unable to generate the connection note right now. Please try again.",
} as const
