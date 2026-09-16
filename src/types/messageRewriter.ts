import type { EditablePrompt } from "./prompts"
import type { RequestSource } from "./promptCreator"

// The message was typed or spoken, the same two ways the Prompt Creator takes its description
export type MessageSource = RequestSource

/**
 * One rewritten message, as the page shows it.
 */
export interface RewrittenMessage {
  // The short English message, ready to send
  message: string
  // The language the original was written in, named in English ("Urdu"), or "English"
  sourceLanguage: string
  characterCount: number
  originalCharacters: number
  // False when the humanizer's rewrite broke a check, so the checked draft is what you see
  humanized: boolean
}

export type MessageRewriterPrompt = EditablePrompt
