import { connectDatabase } from "@/lib/db"
import { DUMMY_ITEM_ID_PATTERN, dummyKindConfig, type DummyDataKind } from "@/constants/dummyData"
import { DummyItem as DummyItemModel, type IDummyItem } from "@/models/DummyItem"
import type { DummyItem } from "@/types/dummyData"

/**
 * Dummy Data items live in the dummy_data collection, one document per item, identified
 * within its kind by an id (slug) derived from its name.
 */
const ID_MAX_LENGTH = 50
const DUPLICATE_KEY = 11000

export interface DummyItemInput {
  name: string
  fields: Record<string, string>
}

type StoredItem = Pick<IDummyItem, "slug" | "name" | "fields" | "createdAt">

// Only the kind's own fields are kept, each trimmed
function cleanFields(kind: DummyDataKind, values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(dummyKindConfig(kind).fields.map((field) => [field.key, (values[field.key] ?? "").trim()]))
}

// Every field of the kind is present, even one added after the item was saved
function toDummyItem(kind: DummyDataKind, { slug, name, fields, createdAt }: StoredItem): DummyItem {
  return { id: slug, name, fields: cleanFields(kind, fields ?? {}), createdAt: createdAt.toISOString() }
}

const cleanName = (name: string) => name.replace(/\s+/g, " ").trim()

function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, ID_MAX_LENGTH)
    .replace(/^-+|-+$/g, "")
  return slug || "item"
}

const isDuplicateKey = (error: unknown) => (error as { code?: number } | null)?.code === DUPLICATE_KEY

export async function listDummyItems(kind: DummyDataKind): Promise<DummyItem[]> {
  await connectDatabase()
  const items = await DummyItemModel.find({ kind }).sort({ createdAt: 1, name: 1 }).lean()
  return items.map((item) => toDummyItem(kind, item))
}

/**
 * Saves a new item under an id derived from its name (with a number added when that id
 * is taken). The unique (kind, id) index means an existing item is never overwritten.
 */
export async function createDummyItem(kind: DummyDataKind, { name, fields }: DummyItemInput): Promise<DummyItem> {
  await connectDatabase()
  const item = { kind, name: cleanName(name), fields: cleanFields(kind, fields) }
  const base = slugify(item.name)
  for (let suffix = 1; ; suffix++) {
    try {
      const created = await DummyItemModel.create({ ...item, slug: suffix === 1 ? base : `${base}-${suffix}` })
      return toDummyItem(kind, created)
    } catch (error: unknown) {
      if (!isDuplicateKey(error)) throw error
    }
  }
}

/**
 * Replaces an item's name and fields, keeping its id and creation time. Returns null
 * when the item doesn't exist.
 */
export async function updateDummyItem(kind: DummyDataKind, id: string, { name, fields }: DummyItemInput): Promise<DummyItem | null> {
  if (!DUMMY_ITEM_ID_PATTERN.test(id)) return null
  await connectDatabase()
  const updated = await DummyItemModel.findOneAndUpdate(
    { kind, slug: id },
    { name: cleanName(name), fields: cleanFields(kind, fields) },
    { returnDocument: "after", runValidators: true }
  ).lean()
  return updated ? toDummyItem(kind, updated) : null
}

/**
 * Deletes an item. Returns false when it didn't exist.
 */
export async function deleteDummyItem(kind: DummyDataKind, id: string): Promise<boolean> {
  if (!DUMMY_ITEM_ID_PATTERN.test(id)) return false
  await connectDatabase()
  const { deletedCount } = await DummyItemModel.deleteOne({ kind, slug: id })
  return deletedCount > 0
}
