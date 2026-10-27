/**
 * Administration → Global AI Prompts: which stored prompts belong to which module, and how the page
 * that edits them reads.
 *
 * Every prompt is one document in the `prompts` collection, and its `tool` field says which module
 * it belongs to. The page lists **what is stored**, so a prompt a script adds appears there with no
 * change to the app: the modules named below get their sidebar name, area and icon, and any other
 * `tool` is still listed, under Other, by its own name. Nothing a model reads is written in code: a
 * prompt that is not in the collection fails loudly (`PromptTemplateMissing`) rather than being
 * replaced by text in the source.
 */

export const ADMIN_PROMPTS_ENDPOINT = "/api/admin/prompts"

// A `tool` value as the collection stores it, so the query string can carry nothing else
export const PROMPT_TOOL_PATTERN = /^[a-z0-9-]{1,60}$/

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

// The prompts that belong to no one module: the global ones (Humanization, Profile Info) and the ones
// every tool shares (the humanizer's rules, lead signals, reading a screenshot, About Me). They head
// the page's list, before the areas.
export const GLOBAL_PROMPT_TOOL = "global-prompts"
export const SHARED_PROMPT_TOOL = "shared"
export const GLOBAL_SECTION_ID = "global"
export const GLOBAL_SECTION_TOOLS = [GLOBAL_PROMPT_TOOL, SHARED_PROMPT_TOOL] as const
export const GLOBAL_SECTION_LABEL = "Global & shared"
export const GLOBAL_SECTION_DESCRIPTION = "Humanization, Profile Info, About Me and the rules every tool shares"

// The heading the modules no area names are listed under
export const OTHER_PROMPTS_LABEL = "Other"

// How long typing must pause before an edited prompt saves itself (Important Content's pause)
export const PROMPT_AUTOSAVE_DELAY_MS = 1500

// The prompts whose key says too little on its own, by the name the app gives them elsewhere
const NAMED_PROMPTS: Record<string, string> = {
  "global-humanization": "Humanization Prompt",
  "global-rafay-profile": "Profile Info",
  "sender-profile": "About Me",
}

// A module's keys start with its own name ("connection-note-system"), or with a shorter one for the
// modules whose prompts were named before the module was ("inmail-system", "follow-up-system")
export const promptPrefixesOf = (tool: string): string[] => [
  tool,
  tool.replace(/-message$/, ""),
  tool.replace(/s$/, ""),
  tool.replace(/-replies$/, "-reply"),
  tool.replace(/-messaging$/, "-message"),
]

/**
 * A stored prompt's name as an admin reads it: the key without the module's own prefix, in words.
 * "connection-note-rewrite" -> "Rewrite", "comment-writer-research-lenses" -> "Research lenses".
 */
export function promptLabel(key: string, prefixes: readonly string[]): string {
  if (key in NAMED_PROMPTS) return NAMED_PROMPTS[key]
  const prefix = [...prefixes].sort((a, b) => b.length - a.length).find((candidate) => key.startsWith(`${candidate}-`))
  const rest = prefix ? key.slice(prefix.length + 1) : key
  const words = rest.replace(/-/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export const ADMIN_PROMPT_MESSAGES = {
  navHeading: "Prompts by module",
  navHint: "Every module that sends the AI a prompt. Pick one to edit its prompts here.",
  searchModules: "Search modules",
  noModuleMatch: "No module matches.",
  chooseModule: "Module",
  systemHeading: "System instructions",
  systemHint: "The rules and wording this module always sends the AI. Users never see these.",
  userHeading: "User instructions",
  userHint: "The prompts users choose between on the page: its tones, tunes, styles and targets.",
  globalUserHint: "The prompts every tool reads: the rewrite every result goes through, and the facts about you.",
  noneStored: "This module has no prompts stored.",
  promptCount: (total: number) => `${total} ${total === 1 ? "prompt" : "prompts"}`,
  systemBadge: "System",
  userBadge: "User",
  customBadge: "Edited",
  restoreDefault: "Restore default",
  autosaveNote: "Saves itself as you type. A saved change is used by the next result anyone writes, on every device.",
  saving: "Saving...",
  savedAt: (time: string) => `Saved at ${time}`,
  unsaved: "Changes not saved yet",
  tooShort: (min: number) => `Write at least ${min} characters to save.`,
  tooLong: (max: number) => `Keep it under ${max.toLocaleString()} characters to save.`,
  characters: (count: number) => `${count.toLocaleString()} characters`,
  unknownTool: "That module has no prompts an admin can edit here.",
  unknownPrompt: "That prompt isn't in the prompts collection.",
  saved: "Saved. The next result anyone writes uses it.",
  saveFailed: "Couldn't save the prompt. Please try again.",
  loadFailed: "Couldn't load the prompts. Please try again.",
} as const
