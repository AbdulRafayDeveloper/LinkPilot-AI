import { Wand2, type LucideIcon } from "lucide-react"

/**
 * Prompt Creator target registry. Each target owns an independent, separately stored prompt
 * (prompt record: prompt-creator-<id> in the prompts collection) that decides how the
 * finished prompt is shaped. Adding a target means adding an entry here plus its prompt record.
 */
export const PROMPT_TARGETS = [
  {
    id: "editor-agent",
    label: "Cursor / Claude / Antigravity",
    shortLabel: "Coding agent",
    description: "Steps to follow, then a validation pass",
  },
  {
    id: "web-search",
    label: "ChatGPT / Gemini Search",
    shortLabel: "AI search",
    description: "Sourced research with a comparison",
  },
] as const

export type PromptTargetId = (typeof PROMPT_TARGETS)[number]["id"]

export const PROMPT_TARGET_IDS = PROMPT_TARGETS.map((target) => target.id) as [PromptTargetId, ...PromptTargetId[]]

export const DEFAULT_PROMPT_TARGET: PromptTargetId = "editor-agent"

export function getPromptTargetLabel(target: PromptTargetId): string {
  return PROMPT_TARGETS.find((entry) => entry.id === target)?.label ?? target
}

export const PROMPT_TARGET_TABS = PROMPT_TARGETS.map((target) => ({ id: target.id, label: target.shortLabel }))

// What the user describes, by voice or by typing
export const REQUEST_MAX_LENGTH = 8000
// The name the model writes for the prompt, and the user can rewrite
export const CREATED_NAME_MAX_LENGTH = 80
// The finished prompt
export const CREATED_PROMPT_MAX_LENGTH = 20000
// One recording; roughly 10 minutes of speech
export const VOICE_MAX_BYTES = 12 * 1024 * 1024
export const VOICE_MAX_SECONDS = 300

export const PROMPT_CREATOR_ENDPOINT = "/api/prompt-creator"

export const PROMPT_CREATOR_MESSAGES = {
  missingRequest: "Describe the task you want a prompt for, by typing or by speaking.",
  requestTooLong: `Your description must be under ${REQUEST_MAX_LENGTH.toLocaleString()} characters.`,
  missingTarget: "Choose what the prompt is for.",
  generationFailed: "Couldn't create the prompt. Please try again.",
  missingName: "Give the prompt a name.",
  nameTooLong: `The name must be under ${CREATED_NAME_MAX_LENGTH} characters.`,
  emptyPrompt: "The prompt can't be empty.",
  saveFailed: "Couldn't save your changes. Please try again.",
  notFound: "That saved prompt no longer exists.",
  // Voice input
  micDenied: "Microphone access was blocked. Allow it in your browser, or type the description instead.",
  micUnavailable: "This browser can't record audio. Please type the description instead.",
  recordingFailed: "The recording didn't work. Please try again, or type the description.",
  emptyRecording: "Nothing was recorded. Please try again.",
  audioTooLarge: "That recording is too long. Please keep it under 5 minutes.",
  unsupportedAudio: "That audio format isn't supported. Please record again.",
  unclearAudio: "Couldn't make out any speech. Please record again in a quieter place, or type the description.",
  transcriptionFailed: "Couldn't turn the recording into text. Please try again, or type the description.",
  voiceUnavailable:
    "Speaking needs an AI provider that can read audio. Set GOOGLE_API_KEY, or OPENAI_API_KEY with OPENAI_TRANSCRIPTION_MODEL, in .env.local.",
} as const

// The module's sidebar entry, listed after the LinkedIn tools
export const PROMPT_CREATOR_TOOL: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: "build"
} = {
  id: "prompt-creator",
  title: "Prompt Creator",
  description: "Turn a task into an AI prompt",
  icon: Wand2,
  href: "/prompt-creator",
  group: "build",
}
