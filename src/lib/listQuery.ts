import mongoose from "mongoose"

/**
 * The pieces every newest-first, filtered list is built from on the server: a plain-text search,
 * a date range and a cursor that points at the last row of the batch before.
 */

const CURSOR_SEPARATOR = "|"
const ID_PATTERN = /^[0-9a-f]{24}$/

// Anything the regular expression engine would read is escaped, so a search is plain text
export const escapeForSearch = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)

/** A case-insensitive match of the search on any of the fields, or nothing when there is no search. */
export function searchCondition(search: string, fields: readonly string[]): Record<string, unknown> | null {
  const term = search.trim()
  if (!term || fields.length === 0) return null
  const pattern = new RegExp(escapeForSearch(term), "i")
  return { $or: fields.map((field) => ({ [field]: pattern })) }
}

/** Rows made inside the range. Either end may be open. */
export function createdBetween(from: string | null, to: string | null): Record<string, unknown> | null {
  if (!from && !to) return null
  return {
    createdAt: {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lte: new Date(to) } : {}),
    },
  }
}

/** A cursor for the row a batch ended on: its time, and its id to separate rows sharing one. */
export const toCursor = (row: { createdAt: Date; _id: { toString: () => string } }) =>
  `${new Date(row.createdAt).toISOString()}${CURSOR_SEPARATOR}${row._id.toString()}`

/**
 * Everything older than the row the cursor points at. An unreadable cursor is ignored rather than
 * failing the request, so a stale browser tab simply starts again from the newest row.
 */
export function olderThanCursor(cursor: string | null): Record<string, unknown> | null {
  const [time, id] = (cursor ?? "").split(CURSOR_SEPARATOR)
  const createdAt = new Date(time ?? "")
  if (!cursor || Number.isNaN(createdAt.getTime()) || !ID_PATTERN.test(id ?? "")) return null
  return { $or: [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: new mongoose.Types.ObjectId(id) } }] }
}

/** Every condition that applies, as one filter. */
export function allOf(conditions: (Record<string, unknown> | null)[]): Record<string, unknown> {
  const present = conditions.filter((condition): condition is Record<string, unknown> => condition !== null)
  return present.length === 0 ? {} : { $and: present }
}
