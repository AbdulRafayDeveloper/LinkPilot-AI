/**
 * What the outreach modules (First Message and InMail) share: the About Me tab, and the format
 * the outreach is written in. Each module keeps its own tone list (constants/firstMessage.ts,
 * constants/inmail.ts); the sender profile (services/senderProfile.ts) is edited as an extra tab
 * next to those prompts.
 */
export const ABOUT_ME_TAB_ID = "about-me"
export const ABOUT_ME_TAB_LABEL = "About Me (sender)"

/**
 * Text or a voice note. **Text is what the tools always were**: every tone, written to be sent as
 * a message, and nothing about it changed. Voice writes one script to read aloud and record, and
 * has a single tone of its own (VOICE_TUNE), so the tone cards show that one card.
 */
export const OUTREACH_FORMATS = [
  { id: "text", label: "Text", description: "A written message, in any tone" },
  { id: "voice", label: "Voice note", description: "A short script to record and send" },
] as const

export type OutreachFormatId = (typeof OUTREACH_FORMATS)[number]["id"]
export const OUTREACH_FORMAT_IDS = OUTREACH_FORMATS.map((format) => format.id) as [OutreachFormatId, ...OutreachFormatId[]]
// What the tools have always done, so nothing changes until the user picks Voice note
export const DEFAULT_OUTREACH_FORMAT: OutreachFormatId = "text"

/**
 * The A, B, C, D method: a short personal message that ends by offering four replies, so answering
 * costs one letter (lib/abcdMethod.ts holds the four, which are fixed in code). It is the first
 * tone and the default in both modules, at the owner's request.
 */
export const ABCD_TUNE_ID = "abcd-method"
export const ABCD_TUNE = {
  id: ABCD_TUNE_ID,
  label: "ABCD Method",
  description: "Recommended · They reply with A, B, C or D",
} as const

/** The one tone a voice note has, in both modules. Its prompt is `<module>-voice-note`. */
export const VOICE_TUNE_ID = "voice-note"
export const VOICE_TUNE = {
  id: VOICE_TUNE_ID,
  label: "Voice Note",
  description: "A 40 to 50 second script to record",
  format: "voice",
} as const

/**
 * A voice note has to be deliverable in under 50 seconds, so it is counted in words rather than
 * characters: around 95 to 110 words is 40 to 48 seconds at an ordinary speaking pace, and 120 is
 * the ceiling. `WORDS_A_SECOND` is what the estimate shown beside a script is worked out from.
 */
export const VOICE_NOTE_TARGET_WORDS = 110
export const VOICE_NOTE_MAX_WORDS = 120
export const WORDS_A_SECOND = 2.3
// Room for the script in a field counted in characters; the word count is what really caps it
export const VOICE_NOTE_MAX_CHARS = 900
