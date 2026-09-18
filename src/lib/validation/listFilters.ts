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

/**
 * What a bulk delete covers: the records named by `ids`, or everything the filters cover when
 * `all` is true. One or the other, never neither.
 */
export const BulkDeleteSchema = z
  .object({ ids: z.array(z.string().regex(/^[0-9a-f]{24}$/)).min(1).max(200).optional(), all: z.boolean().optional() })
  .refine((body) => (body.ids === undefined) !== (body.all !== true), "Choose what to delete, or delete everything the filters cover.")
