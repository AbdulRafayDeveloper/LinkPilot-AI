import { SAVED_OUTPUT_TOOLS } from "./savedOutputs"

/**
 * **A filter the user puts on stays on until they take it off**, on every page in the app that has
 * one, at the owner's request: moving to another tool and back, reloading, signing out and in, or
 * opening the app on another machine all find the list exactly as they left it.
 *
 * One mechanism serves every page (`services/savedFilters.ts`, `hooks/useSavedFilters.ts`,
 * `GET`/`PUT /api/view-filters/[view]`), because thirteen pages each remembering their own filters
 * their own way is thirteen things to get wrong. What a page keeps is a handful of short strings,
 * which is all any of these filters are: a search, a choice, a day.
 *
 * **It is only what is filtered on, never the data.** The page sends these to its own API exactly as
 * it did when they were typed, so the filtering still happens in the database and a filter covers
 * the whole list rather than the page on screen.
 */

// Every page that remembers its filters, and the keys each one may keep. A key that is not listed
// is dropped on the way in and on the way out, so a page can never be handed a filter it cannot show
export const FILTER_VIEWS: Record<string, readonly string[]> = {
  "daily-tasks": ["priority", "doer", "blocked", "done"],
  meetings: ["search", "status"],
  "personal-drive": ["search", "type"],
  "reference-content": ["search"],
  "important-content": ["search", "type", "folder"],
  "client-projects": ["search", "client", "status"],
  // One project's own page: what the open tab is narrowed to. The shared link keeps none of this
  "client-project": ["search", "priority", "status", "signed", "stage", "shared"],
  "client-voices-history": ["search", "client", "from", "to"],
  clients: ["search"],
  employees: ["search", "status"],
  "profile-scheduler": ["search", "day", "type", "pageSize"],
  "post-images": ["search", "size", "photo", "from", "to"],
  "trending-history": ["search", "category", "format", "status", "from", "to"],
  "admin-audit": ["search", "event", "from", "to"],
  "admin-backups": ["search", "status", "trigger", "from", "to"],
  "admin-users": ["search", "role"],
  "activity-logs": ["search", "module", "action", "outcome", "from", "to"],
  // One account's activities for an admin, with whether the person deleted them
  "admin-user-activities": ["search", "module", "action", "outcome", "state", "from", "to"],
  // AI Model Priority, one view per tab: Models in use, Priority order, Usage & cost, Prices
  "admin-model-map": ["search", "module", "job", "provider", "show"],
  "admin-model-order": ["search", "order", "need", "skipped"],
  "admin-ai-costs": ["period", "from", "to", "provider", "model", "module", "kind"],
  "admin-ai-prices": ["search", "provider", "priced"],
  // The ten "view all" pages share one page and one shape, so they share these keys under their own ids
  ...Object.fromEntries(
    SAVED_OUTPUT_TOOLS.map((tool) => [
      savedOutputsView(tool.id),
      ["search", "option", "context", "folder", "dependency", "from", "to"] as readonly string[],
    ])
  ),
}

/** The view id of one tool's "view all" page, so the ten of them never share one another's filters. */
export function savedOutputsView(tool: string): string {
  return `saved-outputs:${tool}`
}

/** Whether this is a page that remembers its filters at all. */
export const isFilterView = (view: string): boolean => Object.hasOwn(FILTER_VIEWS, view)

// A filter is a search, a choice or a day, so anything longer than this was never one of ours
export const FILTER_VALUE_MAX_LENGTH = 200
// The most keys one view may keep, which is well over what the widest page has
export const FILTER_KEYS_MAX = 12

export const SAVED_FILTERS_ENDPOINT = "/api/view-filters"

export const SAVED_FILTERS_MESSAGES = {
  unknownView: "That page does not keep filters.",
  invalid: "Those aren't filters this page has.",
  // Said on the page itself: the filter is still on, it simply was not kept for next time
  saveFailed: "Filters are on, but couldn't be saved for next time.",
  clear: "Clear filters",
} as const
