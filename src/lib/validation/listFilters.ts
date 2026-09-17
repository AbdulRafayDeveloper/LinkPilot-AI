import { z } from "zod"
import { HISTORY_CURSOR_MAX_LENGTH, HISTORY_MESSAGES, HISTORY_SEARCH_MAX_LENGTH } from "@/constants/historyFilters"

/**
 * Query string pieces every "view all" list reads the same way. A blank value counts as not set,
 * and anything unreadable is refused with a message, so a filter never looks applied when it was not.
 */
export const blankToEmpty = (value: unknown) => (typeof value === "string" ? value.trim() : "")

export const searchParam = z.preprocess(blankToEmpty, z.string().max(HISTORY_SEARCH_MAX_LENGTH))

export const cursorParam = z.preprocess(
  (value) => blankToEmpty(value) || null,
  z.string().max(HISTORY_CURSOR_MAX_LENGTH).nullable()
)

// The start or end of a chosen day, worked out in the viewer's timezone by the page
export const dayBoundParam = z.preprocess((value) => blankToEmpty(value) || null, z.iso.datetime({ offset: true }).nullable())

/** One choice from a fixed list, or "" for every one. */
export const choiceParam = <T extends string>(ids: readonly [T, ...T[]]) =>
  z.preprocess(blankToEmpty, z.union([z.literal(""), z.enum(ids)]))

export const inDateOrder = (query: { from: string | null; to: string | null }) =>
  !query.from || !query.to || new Date(query.from) <= new Date(query.to)

export const DATE_ORDER_ISSUE = { message: HISTORY_MESSAGES.badDateRange }
