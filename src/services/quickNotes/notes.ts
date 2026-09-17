import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { QuickNote as QuickNoteModel, type IQuickNote } from "@/models/QuickNote"
import { NOTES_BATCH_SIZE } from "@/constants/quickNotes"
import type { QuickNote, QuickNotesFeed } from "@/types/quickNotes"
import type { Viewer } from "@/types/auth"
import { ownedBy, visibleById, visibleTo } from "@/services/auth/viewer"

/**
 * Saved notes live in the quick_notes collection. Each note belongs to the account that saved it:
 * a user sees their own notes, an admin sees everyone's.
 */
type StoredNote = IQuickNote & { _id: { toString: () => string } }

const CURSOR_SEPARATOR = "|"
const ID_PATTERN = /^[0-9a-f]{24}$/

const toNote = (record: StoredNote): QuickNote => ({
  id: record._id.toString(),
  content: record.content,
  createdAt: record.createdAt.toISOString(),
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
export async function saveNote(viewer: Viewer, content: string): Promise<QuickNote> {
  await connectDatabase()
  const record = await QuickNoteModel.create({ ownerId: viewer.id, content })
  return toNote(record as unknown as StoredNote)
}

/**
 * Deletes one note. Returns false when it was already gone, so a repeated click is harmless.
 */
export async function deleteNote(viewer: Viewer, id: string): Promise<boolean> {
  const filter = visibleById(viewer, id)
  if (!filter) return false
  await connectDatabase()
  const { deletedCount } = await QuickNoteModel.deleteOne(filter)
  return deletedCount > 0
}

/**
 * Deletes every note the viewer owns (for an admin, also the notes from before accounts existed).
 * Another account's notes are never touched.
 */
export async function clearNotes(viewer: Viewer): Promise<number> {
  await connectDatabase()
  const { deletedCount } = await QuickNoteModel.deleteMany(ownedBy(viewer))
  return deletedCount
}
