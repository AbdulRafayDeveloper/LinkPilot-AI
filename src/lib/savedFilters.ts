import { FILTER_KEYS_MAX, FILTER_VALUE_MAX_LENGTH, FILTER_VIEWS } from "@/constants/savedFilters"

/**
 * What a page's filters are, and what may be kept of them: a handful of short strings, which is all
 * any filter in this app is (a search, a choice, a day).
 *
 * Kept away from the database and the pages so the rules can be read and tested on their own
 * (`tests/savedFilters.test.mjs`). Both ends use them: the route cleans what it is given before
 * writing, and the page cleans what it is handed before showing it, so a value stored by an older
 * version of a page, or by anything that went round the app, can never put a filter on screen that
 * the page has no way to take off again.
 */

export type SavedFilters = Record<string, string>

export const NO_SAVED_FILTERS: SavedFilters = {}

/**
 * The filters of one view, with everything that is not one dropped: an unknown key, a value that is
 * not a string, one longer than a filter ever is, and anything empty, since empty **is** the way a
 * filter says it is off.
 */
export function cleanFilters(view: string, raw: unknown): SavedFilters {
  const allowed = FILTER_VIEWS[view]
  if (!allowed || !raw || typeof raw !== "object") return NO_SAVED_FILTERS
  const kept: SavedFilters = {}
  for (const key of allowed) {
    const value = (raw as Record<string, unknown>)[key]
    if (typeof value !== "string") continue
    const text = value.trim()
    if (!text || text.length > FILTER_VALUE_MAX_LENGTH) continue
    kept[key] = text
    if (Object.keys(kept).length >= FILTER_KEYS_MAX) break
  }
  return kept
}

/** Whether anything is filtered at all, which is what shows Clear filters. */
export const isFiltering = (filters: SavedFilters): boolean => Object.values(filters).some((value) => value !== "")

/** Whether two sets of filters say the same thing, so nothing is saved or reloaded for no reason. */
export function sameFilters(one: SavedFilters, two: SavedFilters): boolean {
  const keys = new Set([...Object.keys(one), ...Object.keys(two)])
  for (const key of keys) {
    if ((one[key] ?? "") !== (two[key] ?? "")) return false
  }
  return true
}

/**
 * The page's own filters as they are kept: every key it carries, with "" for the ones that are off,
 * so what is written is exactly what the page shows.
 */
export function filtersOf(values: object): SavedFilters {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]: [string, unknown]) => [key, value === undefined || value === null ? "" : String(value)])
  )
}

/**
 * A choice read back from the account, kept only while the page can still offer it. A status an
 * older version of a page had, or a tone that has since been renamed, reads as off rather than
 * filtering every record out with nothing on screen able to put it right.
 */
export const oneOf = <T extends string>(value: string | undefined, allowed: readonly string[]): T | "" =>
  value && allowed.includes(value) ? (value as T) : ""

/** A day read back from the account, kept only when it really is one, since a page sends it as it is. */
export const savedDay = (value: string | undefined): string => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "")

/** A search, or any other free text, read back from the account. */
export const savedText = (value: string | undefined): string => value ?? ""
