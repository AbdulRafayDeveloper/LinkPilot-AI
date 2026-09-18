import { APP_TOOLS, type LinkedInTool } from "@/constants/linkedinTools"

/**
 * Turning a tool off for one account. An admin decides, per user, which of the app's tools that
 * account may use; a tool that is off is not in their sidebar, its pages send them away and its
 * API refuses them. Nothing is deleted: what they already made stays, and turning the tool back
 * on brings it back exactly as it was.
 */

/**
 * Which API paths belong to which tool. It is written out rather than derived from the tool's
 * `href`, because several do not match (`/connection-note` is served by `/api/connection-notes`),
 * and a guess that silently matches nothing would leave the tool's API open to an account the
 * admin has turned it off for. `tests/featureAccess.test.mjs` checks every tool is here and that
 * every API folder is either claimed by a tool or named as shared, so a new route cannot slip out.
 */
export const FEATURE_API_PATHS: Record<string, string[]> = {
  "trending-topics": ["/api/trending-topics"],
  "post-image-creator": ["/api/post-images"],
  "connection-note": ["/api/connection-notes"],
  "first-message": ["/api/first-messages"],
  "inmail-composer": ["/api/inmail-messages"],
  "comment-writer": ["/api/comment-writer"],
  "post-comment-replies": ["/api/post-comment-replies"],
  "follow-up-message": ["/api/follow-up-messages"],
  "conversation-reply": ["/api/conversation-replies"],
  clients: ["/api/clients"],
  "client-messaging": ["/api/client-messaging"],
  "message-rewriter": ["/api/message-rewriter"],
  "client-voices": ["/api/client-voices"],
  "reference-content": ["/api/reference-content"],
  "meeting-planner": ["/api/meeting-planner"],
  meetings: ["/api/meetings"],
  "prompt-creator": ["/api/prompt-creator"],
  // Nested under Prompt Creator's folder, but the Projects page's own; the longest path wins
  projects: ["/api/prompt-creator/projects"],
  "daily-tasks": ["/api/daily-tasks", "/api/task-images"],
  "quick-notes": ["/api/quick-notes"],
  "important-files": ["/api/important-files"],
  "important-content": ["/api/important-content"],
  employees: ["/api/employees"],
}

/**
 * API folders that belong to no single tool, so a disabled tool never reaches them: signing in,
 * the admin area (its own role check), the shared prompts and dummy data, the shared transcription
 * endpoint, the status page and the employee's public plan link. `/api/saved-outputs` is shared in
 * the same sense but names its tool in the path, so it is handled on its own.
 */
// Where the admin reads and changes the tools for every user
export const FEATURE_DEFAULTS_ENDPOINT = "/api/admin/features"

export const SHARED_API_PATHS = [
  "/api/auth",
  "/api/admin",
  "/api/ai-status",
  "/api/dummy-data",
  "/api/global-prompts",
  "/api/transcribe",
  "/api/public",
  "/api/saved-outputs",
]

// A safety net on the request body: nobody can send more ids than the app has tools
export const MAX_FEATURE_IDS = 100

/** The tools an admin can turn off. The admin area is never one of them, so nobody can be locked out of it. */
export const manageableFeatures = (): LinkedInTool[] => APP_TOOLS.filter((tool) => !tool.adminOnly)

export const FEATURE_ACCESS_MESSAGES = {
  // What a user sees if they reach a tool that is off for them
  unavailable: "This tool is not available on your account. Ask an admin if you need it.",
  loadFailed: "Couldn't load what this account can use. Please try again.",
  saveFailed: "Couldn't save what this account can use. Please try again.",
  adminsKeepEverything: "An admin always has every tool, so there is nothing to turn off here.",
  unknownTool: "That isn't one of the tools that can be turned off.",
  saved: "Saved. What this account can use takes effect at once.",
  savedForEveryone: "Saved for every user. Accounts with their own choice for a tool keep it.",
  accountGone: "That account no longer exists.",
  defaultsExplains:
    "Turn tools on or off for every user at once. An account with its own choice for a tool, set from that account's page, keeps it. Admins always keep every tool.",
  perUserExplains:
    "Starts from the tools for all users. A switch changed here is this account's own choice and wins over them for this account only. A tool turned off leaves their sidebar and refuses them; nothing they made is deleted.",
} as const
