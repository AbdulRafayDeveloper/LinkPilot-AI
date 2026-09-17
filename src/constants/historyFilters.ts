/**
 * What every "view all" page shares: how many rows one request returns, how long typing settles
 * before a search runs, and the limits and messages of the filters themselves.
 */

// One page or one lazily loaded batch, enforced in each service rather than trusted from the page
export const HISTORY_PAGE_SIZE = 50
export const HISTORY_SEARCH_MAX_LENGTH = 100
export const HISTORY_DEBOUNCE_MS = 300
// Long enough for any real cursor (an ISO time and an id), short enough to refuse junk
export const HISTORY_CURSOR_MAX_LENGTH = 80

export const HISTORY_MESSAGES = {
  badDateRange: "The start date has to be on or before the end date.",
  moreFailed: "Couldn't load more. Try again.",
} as const
