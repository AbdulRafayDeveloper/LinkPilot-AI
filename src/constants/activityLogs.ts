import { ListChecks, type LucideIcon } from "lucide-react"

/**
 * Activity Logs: every action an account takes, kept against that account. Each person reads their
 * own here and can delete any of it, which hides it from them and from nowhere else (a soft delete);
 * an admin reads every activity of any account from User Management, the hidden ones included, and
 * an admin's delete is permanent.
 *
 * An action is any request that changes something (create, edit, delete, generate, upload, move),
 * plus the sign-ins, sign-outs and password changes the audit trail already records. Reading a page
 * is not an action, so it is never logged: a list that refreshes itself would otherwise bury the
 * actions under thousands of reads.
 */

export const ACTIVITY_LOGS_HREF = "/activity-logs"
export const ACTIVITY_LOGS_ENDPOINT = "/api/activity-logs"
// One account's activities for an admin, under that account in User Management
export const adminActivitiesHref = (userId: string) => `/admin/users/${userId}/activities`
export const adminActivitiesEndpoint = (userId: string) => `/api/admin/users/${userId}/activities`

export const ACTIVITY_ACTIONS = [
  { id: "create", label: "Created" },
  { id: "update", label: "Updated" },
  { id: "delete", label: "Deleted" },
  { id: "generate", label: "Generated" },
  { id: "upload", label: "Uploaded" },
  { id: "move", label: "Moved" },
  { id: "reorder", label: "Reordered" },
  { id: "sign-in", label: "Signed in" },
  { id: "sign-up", label: "Signed up" },
  { id: "sign-out", label: "Signed out" },
  { id: "failed-sign-in", label: "Wrong password" },
  { id: "locked", label: "Locked out" },
  { id: "password-changed", label: "Password changed" },
] as const
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number]["id"]
export const ACTIVITY_ACTION_IDS = ACTIVITY_ACTIONS.map((action) => action.id) as [ActivityAction, ...ActivityAction[]]
export const activityActionLabel = (id: string) => ACTIVITY_ACTIONS.find((action) => action.id === id)?.label ?? id

// Whether the request got past the sign-in and access checks, or was refused by them
export const ACTIVITY_OUTCOMES = [
  { id: "allowed", label: "Allowed" },
  { id: "refused", label: "Refused" },
] as const
export type ActivityOutcome = (typeof ACTIVITY_OUTCOMES)[number]["id"]
export const ACTIVITY_OUTCOME_IDS = ACTIVITY_OUTCOMES.map((outcome) => outcome.id) as [ActivityOutcome, ...ActivityOutcome[]]

// What an admin's list shows: everything, what the person still sees, or only what they deleted
export const ACTIVITY_STATES = [
  { id: "visible", label: "Not deleted" },
  { id: "deleted", label: "Deleted by the user" },
] as const
export type ActivityState = (typeof ACTIVITY_STATES)[number]["id"]
export const ACTIVITY_STATE_IDS = ACTIVITY_STATES.map((state) => state.id) as [ActivityState, ...ActivityState[]]

/**
 * The parts of the app that are not tools, named by the start of their API path. A tool's own path
 * names its tool (lib/featureAccess.ts); everything else lands here, or under Other.
 */
export const ACTIVITY_AREAS = [
  { id: "account", label: "Account", paths: ["/api/account", "/api/auth"] },
  { id: "administration", label: "Administration", paths: ["/api/admin", "/api/dummy-data"] },
  { id: "my-ai-profile", label: "My AI Profile", paths: ["/api/global-prompts", "/api/my-profile"] },
  { id: "voice-input", label: "Voice input", paths: ["/api/transcribe"] },
  { id: "task-images", label: "Task images", paths: ["/api/task-images"] },
  { id: "activity-logs", label: "Activity Logs", paths: [ACTIVITY_LOGS_ENDPOINT] },
] as const
export const OTHER_AREA = { id: "other", label: "Other" } as const

/**
 * Requests that are not an action of the person's own, and so are never logged: the sign-in routes
 * (recorded by the audit trail, which writes the activity itself, so a sign-in is never logged
 * twice), the password change (the same), and saving which filters a page is left on, which happens
 * on every click of a filter and records nothing about the work.
 */
export const UNLOGGED_PATHS = ["/api/auth", "/api/account/password", "/api/view-filters"] as const
export const LOGGED_METHODS = ["POST", "PUT", "PATCH", "DELETE"] as const

// The same request repeated within this long is one activity seen N times, not N rows: an editor
// saving itself every second and a recording sending a chunk every ten would otherwise bury the rest
export const ACTIVITY_MERGE_WINDOW_MS = 60_000

export const ACTIVITY_PATH_MAX_LENGTH = 300

export const ACTIVITY_MESSAGES = {
  listFailed: "Couldn't load the activity log. Please try again.",
  deleteFailed: "Couldn't delete those activities. Please try again.",
  notFound: "That activity no longer exists.",
  userNotFound: "That account no longer exists.",
  hiddenNote: "Deleting an activity removes it from your list. It is kept for the administrators.",
  adminDeleteNote: "Deleting here is permanent: the activity is removed from the database for good.",
} as const

export const ACTIVITY_LOGS_TOOL: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: "workspace"
} = {
  id: "activity-logs",
  title: "Activity Logs",
  description: "Everything your account has done",
  icon: ListChecks,
  href: ACTIVITY_LOGS_HREF,
  group: "workspace",
}
