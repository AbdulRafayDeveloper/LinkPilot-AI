import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { ReferenceItem as ReferenceItemModel, type IReferenceItem } from "@/models/ReferenceItem"
import { REFERENCE_PAGE_SIZE } from "@/constants/referenceContent"
import type { ReferenceItem, ReferenceItemInput, ReferenceItemsPage } from "@/types/referenceContent"

/**
 * Saved reference content lives in the reference_content collection, read newest first in
 * batches. Searching matches the name and the text itself, and paging keeps working inside a
 * search because the cursor and the search run in the same query.
 */
type StoredItem = IReferenceItem & { _id: { toString: () => string } }

const CURSOR_SEPARATOR = "|"
const ID_PATTERN = /^[0-9a-f]{24}$/

const toItem = (record: StoredItem): ReferenceItem => ({
  id: record._id.toString(),
  title: record.title,
  content: record.content,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
})

// A cursor points at the last item of a batch: its time, and its id to separate items sharing one
const toCursor = (record: StoredItem) => `${record.createdAt.toISOString()}${CURSOR_SEPARATOR}${record._id.toString()}`

// Anything the regular expression engine would read is escaped, so a search is plain text
const escapeForSearch = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)

/**
 * Everything older than the item the cursor points at. An unreadable cursor is ignored rather
 * than failing the request, so a stale browser tab simply starts again from the newest item.
 */
function olderThan(cursor: string | null) {
  const [time, id] = (cursor ?? "").split(CURSOR_SEPARATOR)
  const createdAt = new Date(time ?? "")
  if (!cursor || Number.isNaN(createdAt.getTime()) || !ID_PATTERN.test(id ?? "")) return []
  const objectId = new mongoose.Types.ObjectId(id)
  return [{ $or: [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: objectId } }] }]
}

// The search matches the name or the text, as typed, with anything the engine would read escaped
function matching(search: string) {
  const term = search.trim()
  if (!term) return []
  const pattern = new RegExp(escapeForSearch(term), "i")
  return [{ $or: [{ title: pattern }, { content: pattern }] }]
}

interface ListOptions {
  search?: string
  cursor?: string | null
  limit?: number
}

/**
 * One batch of saved content, newest first, for the current search. Never more than
 * REFERENCE_PAGE_SIZE items, whatever the caller asks for.
 */
export async function listItems({ search = "", cursor = null, limit = REFERENCE_PAGE_SIZE }: ListOptions = {}): Promise<ReferenceItemsPage> {
  await connectDatabase()
  const size = Math.min(Math.max(1, Math.trunc(limit) || REFERENCE_PAGE_SIZE), REFERENCE_PAGE_SIZE)
  const search_ = matching(search)
  const conditions = [...search_, ...olderThan(cursor)]
  const filter = conditions.length > 0 ? { $and: conditions } : {}
  const [records, total] = await Promise.all([
    // One extra row answers "is there more?" without a second count
    ReferenceItemModel.find(filter).sort({ createdAt: -1, _id: -1 }).limit(size + 1).lean(),
    // The total counts what the search matches, so the header follows the search
    ReferenceItemModel.countDocuments(search_.length > 0 ? { $and: search_ } : {}),
  ])
  const stored = records as unknown as StoredItem[]
  const batch = stored.slice(0, size)
  return {
    items: batch.map(toItem),
    nextCursor: stored.length > size && batch.length > 0 ? toCursor(batch[batch.length - 1]) : null,
    total,
  }
}

export async function createItem({ title, content }: ReferenceItemInput): Promise<ReferenceItem> {
  await connectDatabase()
  const record = await ReferenceItemModel.create({ title: title.trim(), content })
  return toItem(record as unknown as StoredItem)
}

/**
 * Replaces one item's name and text. Returns null when it no longer exists.
 */
export async function updateItem(id: string, { title, content }: ReferenceItemInput): Promise<ReferenceItem | null> {
  if (!ID_PATTERN.test(id)) return null
  await connectDatabase()
  const record = await ReferenceItemModel.findByIdAndUpdate(
    id,
    { title: title.trim(), content },
    { returnDocument: "after", runValidators: true }
  ).lean()
  return record ? toItem(record as unknown as StoredItem) : null
}

/**
 * Deletes one item. Returns false when it was already gone, so a repeated confirm is harmless.
 */
export async function deleteItem(id: string): Promise<boolean> {
  if (!ID_PATTERN.test(id)) return false
  await connectDatabase()
  const { deletedCount } = await ReferenceItemModel.deleteOne({ _id: id })
  return deletedCount > 0
}
