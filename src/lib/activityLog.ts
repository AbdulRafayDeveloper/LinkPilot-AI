import { toolIdForApiPath } from "@/lib/featureAccess"
import { APP_TOOLS } from "@/constants/linkedinTools"
import {
  ACTIVITY_AREAS,
  ACTIVITY_PATH_MAX_LENGTH,
  LOGGED_METHODS,
  OTHER_AREA,
  UNLOGGED_PATHS,
  activityActionLabel,
  type ActivityAction,
} from "@/constants/activityLogs"

/**
 * How a request becomes an activity someone can read: which part of the app it was in, what it did
 * and to what. Kept apart from the database and the request so the rules are tested on their own.
 */

const ID_PATTERN = /^[0-9a-f]{24}$/

const isUnder = (path: string, base: string) => path === base || path.startsWith(`${base}/`)

// The last word of a path that says what the request did, when the method alone would not
const GENERATE_WORDS = new Set(["generate", "english", "prepare", "chat", "transcribe", "process", "analyze"])
const UPLOAD_WORDS = new Set(["images", "task-images", "photo", "voice", "chunks", "files", "uploads", "recording"])
const MOVE_WORDS = new Set(["move", "move-overdue"])
const REORDER_WORDS = new Set(["order", "subtasks"])

/** Whether this request is one of the person's own actions, and so is kept. */
export function isLoggedRequest(method: string, path: string): boolean {
  if (!(LOGGED_METHODS as readonly string[]).includes(method.toUpperCase())) return false
  if (!path.startsWith("/api/")) return false
  return !UNLOGGED_PATHS.some((base) => isUnder(path, base))
}

/** The tool or the part of the app a request belongs to. */
export function activityModuleOf(path: string): string {
  const tool = toolIdForApiPath(path)
  if (tool) return tool
  const area = ACTIVITY_AREAS.find((entry) => entry.paths.some((base) => isUnder(path, base)))
  return area?.id ?? OTHER_AREA.id
}

export interface DescribedActivity {
  action: ActivityAction
  module: string
  // What inside the module was acted on, in words ("tasks", "folders"), or "" for the module itself
  resource: string
  // The record the request named, when its path carries one
  targetId: string | null
  path: string
}

const humanize = (word: string) => word.replace(/-/g, " ")

/** What a request did, read from its method and its path. */
export function describeRequest(method: string, rawPath: string): DescribedActivity {
  const path = rawPath.split("?")[0]!.slice(0, ACTIVITY_PATH_MAX_LENGTH)
  const segments = path.split("/").filter(Boolean).slice(1)
  const ids = segments.filter((segment) => ID_PATTERN.test(segment))
  const words = segments.filter((segment) => !ID_PATTERN.test(segment))
  const last = words.at(-1) ?? ""
  const verb = method.toUpperCase()

  let action: ActivityAction
  if (GENERATE_WORDS.has(last)) action = "generate"
  else if (UPLOAD_WORDS.has(last) && verb !== "DELETE") action = "upload"
  else if (MOVE_WORDS.has(last)) action = "move"
  else if (REORDER_WORDS.has(last) && verb === "PUT") action = "reorder"
  else if (verb === "POST") action = "create"
  else if (verb === "DELETE") action = "delete"
  else action = "update"

  // The first word is the module itself; what follows says what inside it was acted on
  const resource = words
    .slice(1)
    .filter((word) => !GENERATE_WORDS.has(word) && !MOVE_WORDS.has(word))
    .map(humanize)
    .join(" › ")
  return { action, module: activityModuleOf(path), resource, targetId: ids.at(-1) ?? null, path }
}

/**
 * The name a module is read by: the tool's own title from the navigation list, or the name of the
 * part of the app. A "view all" page names its tool by its address, which may differ from the id.
 */
export function activityModuleTitle(id: string): string {
  const tool = APP_TOOLS.find((entry) => entry.id === id || entry.href === `/${id}`)
  if (tool) return tool.title
  const area = ACTIVITY_AREAS.find((entry) => entry.id === id)
  if (area) return area.label
  return id === OTHER_AREA.id ? OTHER_AREA.label : humanize(id).replace(/^\w/, (letter) => letter.toUpperCase())
}

/** One activity as a sentence: "Updated tasks in Client Projects", "Signed in". */
export function activitySummary(entry: { action: string; resource: string; module: string }, moduleTitle: string): string {
  const label = activityActionLabel(entry.action)
  if (entry.module === "account" && !entry.resource) return label
  return `${label}${entry.resource ? ` ${entry.resource}` : ""} in ${moduleTitle}`
}
