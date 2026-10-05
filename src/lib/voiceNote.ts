import { VOICE_NOTE_MAX_WORDS, VOICE_NOTE_TARGET_WORDS, WORDS_A_SECOND } from "@/constants/outreachTunes"

/**
 * A voice note is judged in words, not characters: it has to be sayable in under 50 seconds. Kept
 * away from the database and from any model, so First Message and InMail count the same way and
 * the rules can be tested on their own.
 */

/** How many words a script is: anything with a letter or a digit in it counts as one. */
export const countWords = (text: string) => text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length

/** About how long it takes to say, in whole seconds, at an ordinary speaking pace. */
export const speakingSeconds = (words: number) => Math.round(words / WORDS_A_SECOND)

/** What to tell the model when a script runs long, or null when it is within the ceiling. */
export function voiceNoteProblem(text: string): string | null {
  const words = countWords(text)
  if (words <= VOICE_NOTE_MAX_WORDS) return null
  return `The voice note is ${words} words, over the ${VOICE_NOTE_MAX_WORDS}-word ceiling. Cut it to about ${VOICE_NOTE_TARGET_WORDS} words, keeping the personalized observation and the question at the end.`
}

/** The line shown beside a script: how many words it is and about how long it takes to say. */
export const describeVoiceNote = (words: number) => `${words} words · about ${speakingSeconds(words)} seconds`
