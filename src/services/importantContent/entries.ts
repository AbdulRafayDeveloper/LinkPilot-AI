import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { allOf, searchCondition } from "@/lib/listQuery"
import { ImportantContentModel, type IImportantContent } from "@/models/ImportantContent"
import { HISTORY_PAGE_SIZE } from "@/constants/historyFilters"
import { DEFAULT_CONTENT_TEXT_SIZE } from "@/constants/importantContent"
import { removeUnusedImages } from "./images"
import type { ImportantContent, ImportantContentInput, ImportantContentPage } from "@/types/importantContent"
import type { Viewer } from "@/types/auth"
import { ownedBy, visibleById, visibleTo } from "@/services/auth/viewer"
import { accountNames } from "@/services/auth/accounts"

/**
 * Important Content entries, read a page at a time: exactly HISTORY_PAGE_SIZE (50) to a page, the
 * one changed last first (an edit, auto-saved or not, brings an entry to the top), searched by name
 * and filtered by type in the database. An entry belongs to the
 * account that saved it; a user sees their own, an admin everyone's. The text is never logged.
 */

type StoredEntry = IImportantContent & { _id: { toString: () => string } }

async function toEntries(viewer: Viewer, records: StoredEntry[]): Promise<ImportantContent[]> {
  // Only an admin sees other accounts' entries, so only an admin needs their authors named
  const names = viewer.role === "admin" ? await accountNames(records.map((record) => record.ownerId ?? "")) : null
  return records.map((record) => ({
    id: record._id.toString(),
    name: record.name,
    description: record.description ?? "",
    type: record.type,
    textSize: record.textSize ?? DEFAULT_CONTENT_TEXT_SIZE,
    owner: names ? (names.get(record.ownerId ?? "") ?? "Before accounts") : null,
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
  }))
}

/** Every type the viewer's entries use, one of each, alphabetical, for the type dropdown. */
async function listTypes(viewer: Viewer): Promise<string[]> {
  const types = (await ImportantContentModel.distinct("type", visibleTo(viewer))) as string[]
  return types.filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
}

/** Exactly the entries a search and a type cover, so the list and a bulk delete can never differ. */
function matchingFilter(viewer: Viewer, filters: { search: string; type: string }): Record<string, unknown> {
  return allOf([visibleTo(viewer), searchCondition(filters.search, ["name"]), filters.type ? { type: filters.type } : null])
}

/**
 * One page of entries. A page past the end comes back as the last page rather than as nothing,
 * so deleting the last entry on the last page never leaves an empty screen.
 */
export async function listEntries(viewer: Viewer, filters: { page: number; search: string; type: string }): Promise<ImportantContentPage> {
  await connectDatabase()
  const pageSize = HISTORY_PAGE_SIZE
  const matching = matchingFilter(viewer, filters)
  const [total, types] = await Promise.all([ImportantContentModel.countDocuments(matching), listTypes(viewer)])
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, filters.page), totalPages)
  const records = (await ImportantContentModel.find(matching)
    .sort({ updatedAt: -1, _id: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean()) as unknown as StoredEntry[]
  return { items: await toEntries(viewer, records), page, pageSize, total, totalPages, types }
}

export async function createEntry(viewer: Viewer, input: ImportantContentInput): Promise<ImportantContent> {
  await connectDatabase()
  const record = await ImportantContentModel.create({ ownerId: viewer.id, ...input, textSize: input.textSize ?? DEFAULT_CONTENT_TEXT_SIZE })
  return (await toEntries(viewer, [record.toObject() as unknown as StoredEntry]))[0]
}

/**
 * Replaces an entry's name, description and type, and its text size when one is sent (a caller that
 * doesn't know about sizes leaves it as it was). Null when it's gone or belongs to another account.
 */
export async function updateEntry(viewer: Viewer, id: string, input: ImportantContentInput): Promise<ImportantContent | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const changes = { name: input.name, description: input.description, type: input.type, ...(input.textSize === undefined ? {} : { textSize: input.textSize }) }
  const record = (await ImportantContentModel.findOneAndUpdate(filter, { $set: changes }, { returnDocument: "after", runValidators: true }).lean()) as unknown as StoredEntry | null
  return record ? (await toEntries(viewer, [record]))[0] : null
}

/** Deletes one entry, then the images in it that no other entry uses (the record goes first). */
export async function deleteEntry(viewer: Viewer, id: string): Promise<boolean> {
  const filter = visibleById(viewer, id)
  if (!filter) return false
  await connectDatabase()
  const record = (await ImportantContentModel.findOneAndDelete(filter, { projection: { description: 1 } }).lean()) as { description?: string } | null
  if (!record) return false
  await removeUnusedImages([record.description ?? ""])
  return true
}

/**
 * Deletes several entries at once: the ones named by `ids`, or every entry the search and type
 * cover when `ids` is left out. Both stay inside what the viewer may see, so a user only ever
 * deletes their own. Answers how many were really deleted.
 */
export async function deleteEntries(
  viewer: Viewer,
  filters: { search: string; type: string },
  ids?: string[]
): Promise<{ deleted: number }> {
  await connectDatabase()
  // Ticked rows follow the per-record delete; a whole filter never reaches another account's entries
  const matching = allOf([
    ids ? visibleTo(viewer) : ownedBy(viewer),
    searchCondition(filters.search, ["name"]),
    filters.type ? { type: filters.type } : null,
  ])
  const chosen = ids ? { $and: [matching, { _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } }] } : matching
  // Their images are looked at first and removed after, once no entry left names them
  const withImages = (await ImportantContentModel.find({ $and: [chosen, { description: /\/api\/important-content\/images\// }] }, { description: 1 }).lean()) as {
    description?: string
  }[]
  const { deletedCount } = await ImportantContentModel.deleteMany(chosen)
  await removeUnusedImages(withImages.map((record) => record.description ?? ""))
  return { deleted: deletedCount ?? 0 }
}
