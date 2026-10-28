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
  // A spoken note, read back in English before it goes into the editor
  "quick-notes",
  // A project overview's voice, written out and read back in English
  "client-projects",
  // Guidance on the person's own money and investments, shaped by their My AI Profile
  "finance-bot",
] as const
export type AiModuleId = (typeof AI_MODULE_IDS)[number]

// Modules whose AI calls are counted and attributed but have only one provider, so no order to choose:
// OpenAI images, and My AI Profile (its id is the page's, "global-prompts"), whose vectors only Gemini writes
export const USAGE_ONLY_MODULE_IDS = ["post-image-creator", "global-prompts"] as const
export type UsageOnlyModuleId = (typeof USAGE_ONLY_MODULE_IDS)[number]
export const isUsageOnlyModule = (module: string): module is UsageOnlyModuleId => (USAGE_ONLY_MODULE_IDS as readonly string[]).includes(module)

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
  "quick-notes": ["speech"],
  "client-projects": ["speech"],
  "finance-bot": ["speech"],
}
export const AI_NEED_LABELS: Record<AiNeed, string> = { "web-search": "web search", screenshots: "screenshots", speech: "speech" }

// The pages that record speech, named in the recording's "for" field so it is read in that module's order
export const VOICE_MODULE_IDS = ["prompt-creator", "client-messaging", "message-rewriter", "client-voices", "meeting-planner", "meetings", "quick-notes", "finance-bot"] as const satisfies readonly AiModuleId[]
export type VoiceModuleId = (typeof VOICE_MODULE_IDS)[number]

export const MODEL_PRIORITY_ENDPOINT = "/api/admin/model-priority"

/**
 * The page's tabs, in the order they read: what runs, the order it is tried in, what it used and
 * cost, and the prices. Each answers one question, and the one open is kept in the address
 * (`?tab=`), so a reload or a shared link opens the same tab.
 */
export const MODEL_PAGE_TABS = [
  { id: "models", label: "Models in use", hint: "Which model does each job in each module, and what takes over when it fails." },
  { id: "order", label: "Priority order", hint: "The order each module tries the providers in. Drag to change it; it applies to admin accounts only." },
  { id: "usage", label: "Usage & cost", hint: "How many calls, tokens and minutes of speech each model used, and what they cost." },
  { id: "prices", label: "Prices", hint: "What each model costs, in US dollars. The costs are worked out from these." },
] as const
export type ModelPageTab = (typeof MODEL_PAGE_TABS)[number]["id"]
export const DEFAULT_MODEL_PAGE_TAB: ModelPageTab = "models"
export const isModelPageTab = (value: string | null): value is ModelPageTab => MODEL_PAGE_TABS.some((tab) => tab.id === value)

export const MODEL_PRIORITY_MESSAGES = {
  loadFailed: "Couldn't load the model priorities. Please try again.",
  saveFailed: "Couldn't save that order. Please try again.",
  badOrder: "List every provider exactly once.",
  unknownModule: "That module doesn't use an AI model.",
  nothingMatches: "Nothing matches these filters.",
} as const
