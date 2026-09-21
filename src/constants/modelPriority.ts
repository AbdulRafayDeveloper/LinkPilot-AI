/**
 * AI Model Priority (admin only, /admin/models): the order the AI providers are tried in, per module.
 * Everyone starts from DEFAULT_MODEL_ORDER (Groq first). An admin can change a module's order, and that
 * order is used for admins' own requests to that module; a regular user always gets the default.
 */

// The modules that call an AI model, by their tool id in constants/linkedinTools.ts (their names come from there)
export const AI_MODULE_IDS = [
  "trending-topics",
  "connection-note",
  "first-message",
  "inmail-composer",
  "comment-writer",
  "post-comment-replies",
  "follow-up-message",
  "conversation-reply",
  "client-messaging",
  "message-rewriter",
  "client-voices",
  "meeting-planner",
  "meetings",
  "prompt-creator",
  // Writing a task's details with AI, in Daily Tasks and in an employee's plan
  "daily-tasks",
  "employees",
] as const
export type AiModuleId = (typeof AI_MODULE_IDS)[number]

// Modules whose AI calls are counted and attributed but have only one provider, so no order to choose (OpenAI images)
export type UsageOnlyModuleId = "post-image-creator"

// What each module asks of a provider beyond writing text, so the page can say which providers can't help it
export type AiNeed = "web-search" | "screenshots" | "speech"
export const AI_MODULE_NEEDS: Record<AiModuleId, readonly AiNeed[]> = {
  "trending-topics": ["web-search"],
  "connection-note": [],
  "first-message": [],
  "inmail-composer": [],
  "comment-writer": ["web-search", "screenshots"],
  "post-comment-replies": ["web-search", "screenshots"],
  "follow-up-message": [],
  "conversation-reply": [],
  "client-messaging": ["speech"],
  "message-rewriter": ["speech"],
  "client-voices": ["speech"],
  "meeting-planner": [],
  "meetings": ["speech"],
  "prompt-creator": ["speech"],
  "daily-tasks": [],
  employees: [],
}
export const AI_NEED_LABELS: Record<AiNeed, string> = { "web-search": "web search", screenshots: "screenshots", speech: "speech" }

// The pages that record speech, named in the recording's "for" field so it is read in that module's order
export const VOICE_MODULE_IDS = ["prompt-creator", "client-messaging", "message-rewriter", "client-voices", "meeting-planner", "meetings"] as const satisfies readonly AiModuleId[]
export type VoiceModuleId = (typeof VOICE_MODULE_IDS)[number]

export const MODEL_PRIORITY_ENDPOINT = "/api/admin/model-priority"
export const AI_USAGE_ENDPOINT = "/api/admin/ai-usage"
// The windows the usage summary offers, in days
export const AI_USAGE_DAYS = [1, 7, 30] as const

export const MODEL_PRIORITY_MESSAGES = {
  loadFailed: "Couldn't load the model priorities. Please try again.",
  saveFailed: "Couldn't save that order. Please try again.",
  badOrder: "List every provider exactly once.",
  unknownModule: "That module doesn't use an AI model.",
  usageFailed: "Couldn't load the AI usage. Please try again.",
  badUsageRange: "Choose 1, 7 or 30 days.",
} as const
