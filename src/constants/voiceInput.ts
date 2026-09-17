import type { AiProviderId } from "./aiProviders"

/**
 * Voice input, shared by every module that lets you speak instead of typing (Prompt Creator,
 * Client Messaging, Message Rewriter). One recorder component, one transcription endpoint and
 * one set of messages, so a new module only has to render the button.
 */

// The longest one recording may run; the recorder stops itself here
export const VOICE_MAX_SECONDS = 360
// The recorder warns this long before it stops
export const VOICE_WARN_SECONDS = 30

/**
 * One request to the transcription endpoint. A serverless host refuses a larger body before the
 * route even runs (Vercel's ceiling is 4.5 MB, answered as plain text, not JSON), so a long
 * recording is never sent whole: the browser cuts it into parts (lib/voiceParts.ts).
 */
export const VOICE_MAX_BYTES = 4 * 1024 * 1024

/**
 * How a long recording is cut. Each part is cut at the quietest moment between the two lengths,
 * so a word is never split, and is sent as 16 kHz mono WAV: 100 seconds is 3.2 MB, under
 * VOICE_MAX_BYTES. The length also keeps every part well inside what a transcription model writes
 * back in one answer (OpenAI's transcription models stop at 2,000 output tokens), which a whole
 * six-minute recording, especially in Urdu, can run past.
 */
export const VOICE_PART_MIN_SECONDS = 60
export const VOICE_PART_MAX_SECONDS = 100
export const VOICE_PART_SAMPLE_RATE = 16_000
// Parts written out at once; more would use up a provider's per-minute quota for no real gain
export const VOICE_PART_CONCURRENCY = 2

export const TRANSCRIBE_ENDPOINT = "/api/transcribe"

// Who can write a recording out (named on the page through constants/aiProviders.ts)
// The providers that can read speech: Whisper on Groq and OpenAI's transcription model, in the module's order
export type TranscriptionProvider = Extract<AiProviderId, "groq" | "openai">

const minutes = (seconds: number) => `${seconds / 60} minutes`

export const VOICE_MESSAGES = {
  micDenied: "Microphone access was blocked. Allow it in your browser, or type it instead.",
  micUnavailable: "This browser can't record audio. Please type it instead.",
  recordingFailed: "The recording didn't work. Please try again, or type it instead.",
  emptyRecording: "Nothing was recorded. Please try again.",
  audioTooLarge: `That recording is too large to send. Please keep it under ${minutes(VOICE_MAX_SECONDS)}.`,
  unsupportedAudio: "That audio format isn't supported. Please record again.",
  unclearAudio: "Couldn't make out any speech. Please record again in a quieter place, or type it instead.",
  transcriptionFailed: "Couldn't turn the recording into text. Please try again, or type it instead.",
  voiceUnavailable:
    "Speaking needs an AI provider that can read audio. Set GROQ_API_KEY_1 with GROQ_TRANSCRIPTION_MODEL, or OPENAI_API_KEY with OPENAI_TRANSCRIPTION_MODEL, where the app runs.",
  limit: `Up to ${minutes(VOICE_MAX_SECONDS)}`,
  stoppedAtLimit: `The recording stopped at the ${minutes(VOICE_MAX_SECONDS)} limit. What you said so far is being written out.`,
  partsFailed: (failed: number, total: number) =>
    `${failed} of ${total} parts of your recording couldn't be written out. Your recording is kept, so press Try again rather than speaking again.`,
  // Spoken text that would run past a field's limit keeps its beginning, never an error
  clipped: (skipped: number, maxLength: number) =>
    `Your recording ran past the ${maxLength.toLocaleString()} character limit, so the last ${skipped.toLocaleString()} characters were left out. Everything before that was added.`,
} as const
