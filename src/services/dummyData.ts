import { promises as fs } from "node:fs"
import path from "node:path"
import { UserFacingError } from "@/lib/errors"
import { DUMMY_DATA_KINDS, DUMMY_ITEM_ID_PATTERN, dummyDataMessages, dummyKindConfig, type DummyDataKind } from "@/constants/dummyData"
import type { DummyItem } from "@/types/dummyData"

/**
 * Dummy Data items are plain markdown files, one per item, in src/data/<kind folder>: a
 * small front matter block (name, createdAt) followed by the item's text. A kind with
 * one field stores that text as is; a kind with several fields starts each one with a
 * "<!-- field: key -->" line. No database is involved; the file name is the item id.
 * Writes need a writable file system (local development or a server with a persistent disk).
 */
const DATA_DIR = path.join(process.cwd(), "src/data")
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---[^\S\n]*\r?\n?/
const FIELD_MARKER = /^<!--\s*field:\s*([a-z0-9-]+)\s*-->[^\S\n]*\r?$/gm
const ID_MAX_LENGTH = 50
const READ_ONLY_CODES = new Set(["EROFS", "EACCES", "EPERM"])

export interface DummyItemInput {
  name: string
  fields: Record<string, string>
}

const folderOf = (kind: DummyDataKind) => path.join(DATA_DIR, DUMMY_DATA_KINDS[kind].folder)
const filePath = (kind: DummyDataKind, id: string) => path.join(folderOf(kind), `${id}.md`)
const errorCode = (error: unknown) => (error as NodeJS.ErrnoException | null)?.code

function parseFields(kind: DummyDataKind, body: string): Record<string, string> {
  const { fields } = dummyKindConfig(kind)
  if (fields.length === 1) return { [fields[0].key]: body }
  const values: Record<string, string> = Object.fromEntries(fields.map((field) => [field.key, ""]))
  const markers = [...body.matchAll(FIELD_MARKER)]
  markers.forEach((marker, index) => {
    const start = (marker.index ?? 0) + marker[0].length
    const end = markers[index + 1]?.index ?? body.length
    if (marker[1] in values) values[marker[1]] = body.slice(start, end).trim()
  })
  return values
}

function serializeFields(kind: DummyDataKind, values: Record<string, string>): string {
  const { fields } = dummyKindConfig(kind)
  if (fields.length === 1) return values[fields[0].key] ?? ""
  return fields.map((field) => `<!-- field: ${field.key} -->\n${values[field.key] ?? ""}`).join("\n\n")
}

// Only the kind's own fields are kept, each trimmed
function cleanFields(kind: DummyDataKind, values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(dummyKindConfig(kind).fields.map((field) => [field.key, (values[field.key] ?? "").trim()]))
}

function parse(kind: DummyDataKind, id: string, raw: string): DummyItem {
  const match = raw.match(FRONT_MATTER)
  const meta = new Map<string, string>()
  for (const line of (match?.[1] ?? "").split(/\r?\n/)) {
    const separator = line.indexOf(":")
    if (separator > 0) meta.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim())
  }
  return {
    id,
    name: meta.get("name") || id,
    fields: parseFields(kind, (match ? raw.slice(match[0].length) : raw).trim()),
    createdAt: meta.get("createdAt") || new Date(0).toISOString(),
  }
}

function serialize(kind: DummyDataKind, item: DummyItem): string {
  return `---\nname: ${item.name}\ncreatedAt: ${item.createdAt}\n---\n\n${serializeFields(kind, item.fields)}\n`
}

// Names live on one front matter line
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

async function withWriteErrors<T>(kind: DummyDataKind, write: () => Promise<T>): Promise<T> {
  try {
    return await write()
  } catch (error: unknown) {
    if (READ_ONLY_CODES.has(errorCode(error) ?? "")) throw new UserFacingError(dummyDataMessages(kind).readOnly)
    throw error
  }
}

async function readItem(kind: DummyDataKind, id: string): Promise<DummyItem | null> {
  if (!DUMMY_ITEM_ID_PATTERN.test(id)) return null
  try {
    return parse(kind, id, await fs.readFile(filePath(kind, id), "utf8"))
  } catch (error: unknown) {
    if (errorCode(error) === "ENOENT") return null
    throw error
  }
}

export async function listDummyItems(kind: DummyDataKind): Promise<DummyItem[]> {
  const files = await fs.readdir(folderOf(kind)).catch((error: unknown) => {
    if (errorCode(error) === "ENOENT") return []
    throw error
  })
  const ids = files.filter((file) => file.endsWith(".md")).map((file) => file.slice(0, -3))
  const items = await Promise.all(ids.filter((id) => DUMMY_ITEM_ID_PATTERN.test(id)).map((id) => readItem(kind, id)))
  return items
    .filter((item): item is DummyItem => item !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name))
}

/**
 * Saves a new item under an id derived from its name (with a number added when that id
 * is taken). The file is created exclusively, so an existing item is never overwritten.
 */
export async function createDummyItem(kind: DummyDataKind, { name, fields }: DummyItemInput): Promise<DummyItem> {
  const created: DummyItem = { id: "", name: cleanName(name), fields: cleanFields(kind, fields), createdAt: new Date().toISOString() }
  const base = slugify(created.name)
  return withWriteErrors(kind, async () => {
    await fs.mkdir(folderOf(kind), { recursive: true })
    for (let suffix = 1; ; suffix++) {
      const id = suffix === 1 ? base : `${base}-${suffix}`
      try {
        await fs.writeFile(filePath(kind, id), serialize(kind, { ...created, id }), { encoding: "utf8", flag: "wx" })
        return { ...created, id }
      } catch (error: unknown) {
        if (errorCode(error) !== "EEXIST") throw error
      }
    }
  })
}

/**
 * Replaces an item's name and fields, keeping its id and creation time. Returns null
 * when the item doesn't exist.
 */
export async function updateDummyItem(kind: DummyDataKind, id: string, { name, fields }: DummyItemInput): Promise<DummyItem | null> {
  const existing = await readItem(kind, id)
  if (!existing) return null
  const updated: DummyItem = { ...existing, name: cleanName(name), fields: cleanFields(kind, fields) }
  await withWriteErrors(kind, () => fs.writeFile(filePath(kind, id), serialize(kind, updated), "utf8"))
  return updated
}

/**
 * Deletes an item's file. Returns false when it didn't exist.
 */
export async function deleteDummyItem(kind: DummyDataKind, id: string): Promise<boolean> {
  if (!DUMMY_ITEM_ID_PATTERN.test(id)) return false
  try {
    await withWriteErrors(kind, () => fs.unlink(filePath(kind, id)))
    return true
  } catch (error: unknown) {
    if (errorCode(error) === "ENOENT") return false
    throw error
  }
}
