/**
 * Administration → Global AI Prompts: which stored prompts belong to which module.
 *
 * Every prompt is one document in the `prompts` collection, and its `tool` field says which module
 * it belongs to. A module's own editor (its Update button) covers the prompts its users choose
 * between, the tones, tunes and styles (`editable: true`); **everything else the module sends a
 * model, its system prompt, its research instructions, its rewrite instructions, is a system prompt
 * (`editable: false`)** and is edited here, by an admin, through "System prompts". Nothing a model
 * reads is written in code: a prompt that is not in the collection fails loudly
 * (`PromptTemplateMissing`) rather than being replaced by text in the source.
 */

export const ADMIN_PROMPTS_ENDPOINT = "/api/admin/prompts"

// A module's id in APP_TOOLS -> the `tool` value its prompts are stored under
export const MODULE_PROMPT_TOOLS: Record<string, string> = {
  "comment-writer": "comment-writer",
  "post-comment-replies": "post-comment-replies",
  "inmail-composer": "inmail-message",
  "follow-up-message": "follow-up-message",
  "first-message": "first-message",
  "connection-note": "connection-note",
  "conversation-reply": "conversation-reply",
  "trending-topics": "trending-topics",
  "post-image-creator": "post-image-creator",
  "prompt-creator": "prompt-creator",
  "message-rewriter": "message-rewriter",
  "meeting-planner": "meeting-planner",
  "client-voices": "client-voices",
  meetings: "meetings",
  "client-messaging": "client-messaging",
  "daily-tasks": "daily-tasks",
  "quick-notes": "quick-notes",
}

// Prompts that belong to no one module: the humanizer, lead signals and reading a screenshot
export const SHARED_PROMPT_TOOL = "shared"
export const SHARED_PROMPTS_LABEL = "Shared by every tool"
export const SHARED_PROMPTS_DESCRIPTION = "Humanization rules, lead signals, reading a screenshot"

// Every `tool` value an admin may edit the prompts of, so the API refuses anything else
export const ADMIN_PROMPT_TOOLS = [...new Set([...Object.values(MODULE_PROMPT_TOOLS), SHARED_PROMPT_TOOL])]

/**
 * A stored prompt's name as an admin reads it: the key without the module's own prefix, in words.
 * "connection-note-rewrite" -> "Rewrite", "comment-writer-research-lenses" -> "Research lenses".
 */
export function promptLabel(key: string, prefixes: readonly string[]): string {
  const prefix = prefixes.find((candidate) => key.startsWith(`${candidate}-`))
  const rest = prefix ? key.slice(prefix.length + 1) : key
  const words = rest.replace(/-/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export const ADMIN_PROMPT_MESSAGES = {
  systemButton: "System prompts",
  systemTitle: (module: string) => `${module}: system prompts`,
  systemDescription:
    "The instructions this module sends the AI besides the ones its users choose: its system rules, research, checks and rewrite instructions. A saved change is used by the next result anyone writes, on every device.",
  noneStored: "This module has no system prompts stored.",
  unknownTool: "That module has no prompts an admin can edit here.",
  unknownPrompt: "That prompt isn't in the prompts collection.",
  saved: "Saved. The next result anyone writes uses it.",
  saveFailed: "Couldn't save the prompt. Please try again.",
  loadFailed: "Couldn't load the prompts. Please try again.",
} as const
