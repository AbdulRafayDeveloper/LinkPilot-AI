import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { QuickNote as QuickNoteModel, type IQuickNote } from "@/models/QuickNote"
import { NOTES_BATCH_SIZE } from "@/constants/quickNotes"
import type { QuickNote, QuickNotesFeed } from "@/types/quickNotes"
import type { Viewer } from "@/types/auth"
import type { QuickNoteFields } from "@/lib/validation/quickNotes"
import { ownedBy, visibleById, visibleTo } from "@/services/auth/viewer"
import { NAMES_AN_IMAGE, removeUnusedNoteImages } from "./images"

/**
 * Saved notes live in the quick_notes collection. Each note belongs to the account that saved it:
 * a user sees their own notes, an admin sees everyone's. The images a note names are attachments of
 * it (services/quickNotes/images.ts): every delete here reads which images the notes name, deletes
 * the notes, then removes the images no remaining note names.
 */
type StoredNote = IQuickNote & { _id: { toString: () => string } }

const CURSOR_SEPARATOR = "|"
const ID_PATTERN = /^[0-9a-f]{24}$/

const toNote = (record: StoredNote): QuickNote => ({
  id: record._id.toString(),
  // A note saved before titles existed has none
  title: record.title ?? "",
  content: record.content,
  createdAt: record.createdAt.toISOString(),
  updatedAt: (record.updatedAt ?? record.createdAt).toISOString(),
})

// A cursor points at the last note of a batch: its time, and its id to separate notes sharing one
const toCursor = (record: StoredNote) => `${record.createdAt.toISOString()}${CURSOR_SEPARATOR}${record._id.toString()}`

/**
 * Everything older than the note the cursor points at, in the same newest-first order the index
 * keeps. An unreadable cursor is ignored rather than failing the request, so a stale browser tab
 * simply starts again from the newest note.
 */
function olderThan(cursor: string | null) {
  const [time, id] = (cursor ?? "").split(CURSOR_SEPARATOR)
  const createdAt = new Date(time ?? "")
  if (!cursor || Number.isNaN(createdAt.getTime()) || !ID_PATTERN.test(id ?? "")) return []
  const objectId = new mongoose.Types.ObjectId(id)
  return [{ $or: [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: objectId } }] }]
}

/**
 * One batch of notes, newest first, starting after the cursor when there is one.
 */
export async function listNotes(viewer: Viewer, cursor: string | null, limit = NOTES_BATCH_SIZE): Promise<QuickNotesFeed> {
  await connectDatabase()
  const size = Math.min(Math.max(1, Math.trunc(limit) || NOTES_BATCH_SIZE), NOTES_BATCH_SIZE)
  const [records, total] = await Promise.all([
    // One extra row answers "is there more?" without a second count
    QuickNoteModel.find({ $and: [visibleTo(viewer), ...olderThan(cursor)] }).sort({ createdAt: -1, _id: -1 }).limit(size + 1).lean(),
    QuickNoteModel.countDocuments(visibleTo(viewer)),
  ])
  const stored = records as unknown as StoredNote[]
  const batch = stored.slice(0, size)
  return {
    notes: batch.map(toNote),
    nextCursor: stored.length > size && batch.length > 0 ? toCursor(batch[batch.length - 1]) : null,
    total,
  }
}

/**
 * Saves one note as it was written. The same text can be saved twice: a repeated paste is a
 * second note, which is what the user asked for by pressing Save again.
 */
export async function saveNote(viewer: Viewer, { title, content }: QuickNoteFields): Promise<QuickNote> {
  await connectDatabase()
  const record = await QuickNoteModel.create({ ownerId: viewer.id, title, content })
  return toNote(record as unknown as StoredNote)
}

/**
 * Replaces a note's title and content, which is what an edit's auto-save sends. Answers null when
 * the note is gone or isn't the viewer's to see. An image taken out of the content stays in storage,
 * because Undo can bring it back; it goes when the note does.
 */
export async function updateNote(viewer: Viewer, id: string, { title, content }: QuickNoteFields): Promise<QuickNote | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const record = await QuickNoteModel.findOneAndUpdate(filter, { $set: { title, content } }, { returnDocument: "after" }).lean()
  return record ? toNote(record as unknown as StoredNote) : null
}

/** The content of the notes a delete is about to take that name an image, so their images can follow. */
async function contentsWithImages(filter: Record<string, unknown>): Promise<string[]> {
  const records = (await QuickNoteModel.find({ $and: [filter, NAMES_AN_IMAGE] }, { content: 1 }).lean()) as { content?: string }[]
  return records.map((record) => record.content ?? "")
}

/**
 * Deletes one note. Returns false when it was already gone, so a repeated click is harmless.
 */
export async function deleteNote(viewer: Viewer, id: string): Promise<boolean> {
  const filter = visibleById(viewer, id)
  if (!filter) return false
  await connectDatabase()
  const contents = await contentsWithImages(filter)
  const { deletedCount } = await QuickNoteModel.deleteOne(filter)
  await removeUnusedNoteImages(contents)
  return deletedCount > 0
}

/**
 * Deletes every note the viewer owns (for an admin, also the notes from before accounts existed).
 * Another account's notes are never touched.
 */
export async function clearNotes(viewer: Viewer): Promise<number> {
  await connectDatabase()
  const contents = await contentsWithImages(ownedBy(viewer))
  const { deletedCount } = await QuickNoteModel.deleteMany(ownedBy(viewer))
  await removeUnusedNoteImages(contents)
  return deletedCount
}

/** Deletes the notes named by `ids`, inside the viewer's own notes. Answers how many really went. */
export async function deleteNotes(viewer: Viewer, ids: string[]): Promise<number> {
  await connectDatabase()
  const filter = { ...ownedBy(viewer), _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } }
  const contents = await contentsWithImages(filter)
  const { deletedCount } = await QuickNoteModel.deleteMany(filter)
  await removeUnusedNoteImages(contents)
  return deletedCount ?? 0
}
