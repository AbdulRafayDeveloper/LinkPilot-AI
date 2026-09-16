/**
 * Voice input, shared by every module that lets you speak instead of typing (Prompt Creator,
 * Client Messaging). One recorder component, one transcription endpoint and one set of
 * messages, so a new module only has to render the button.
 */

// One recording; roughly 5 minutes of speech
export const VOICE_MAX_BYTES = 12 * 1024 * 1024
export const VOICE_MAX_SECONDS = 300

export const TRANSCRIBE_ENDPOINT = "/api/transcribe"

export const VOICE_MESSAGES = {
  micDenied: "Microphone access was blocked. Allow it in your browser, or type it instead.",
  micUnavailable: "This browser can't record audio. Please type it instead.",
  recordingFailed: "The recording didn't work. Please try again, or type it instead.",
  emptyRecording: "Nothing was recorded. Please try again.",
  audioTooLarge: "That recording is too long. Please keep it under 5 minutes.",
  unsupportedAudio: "That audio format isn't supported. Please record again.",
  unclearAudio: "Couldn't make out any speech. Please record again in a quieter place, or type it instead.",
  transcriptionFailed: "Couldn't turn the recording into text. Please try again, or type it instead.",
  voiceUnavailable:
    "Speaking needs an AI provider that can read audio. Set GOOGLE_API_KEY, or OPENAI_API_KEY with OPENAI_TRANSCRIPTION_MODEL, in .env.local.",
} as const
