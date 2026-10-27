import { isValidObjectId } from "mongoose"
import { connectDatabase } from "@/lib/db"
import { statusFor, UserFacingError } from "@/lib/errors"
import { entrySchema } from "@/lib/validation/myProfile"
import { sectionById, MY_PROFILE_MESSAGES, type ProfileSection } from "@/constants/profileSections"
import { ProfileEntryModel, type IProfileEntry } from "@/models/ProfileEntry"
import type { EntryFields } from "@/lib/profileSections"
import type { ProfileEntry } from "@/types/myProfile"
import type { Viewer } from "@/types/auth"

/**
 * The entries of one person's My AI Profile: listed, added, edited, reordered and deleted.
 *
 * **Scoped by the account's own id (`viewer.id`)**: a profile is the person's own, like Profile Info and
 * the account photo, and every filter names the account, so an id belonging to anyone else matches
 * nothing (a 404).
 *
 * There is no ceiling on how many entries a section holds. Saving for search is done by the routes
 * after the entry is saved (services/myProfile/vectors.ts), so a write here never waits on Gemini.
 */

/** A refusal a route answers with its own status: 400 for a bad entry, 404 for an unknown section, 409 for a stale order. */
export class ProfileRequestError extends UserFacingError {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "ProfileRequestError"
  }
}

/** The status to answer a failure with. */
export const profileStatusOf = (error: unknown): number => (error instanceof ProfileRequestError ? error.status : statusFor(error, 500))

type StoredEntry = Pick<IProfileEntry, "section" | "fields" | "position" | "searchStatus" | "searchError" | "createdAt" | "updatedAt"> & { _id: unknown }

const toEntry = (doc: StoredEntry): ProfileEntry => ({
  id: String(doc._id),
  section: doc.section,
  fields: (doc.fields ?? {}) as EntryFields,
  position: doc.position,
  searchStatus: doc.searchStatus,
  searchError: doc.searchError,
  createdAt: doc.createdAt.toISOString(),
  updatedAt: doc.updatedAt.toISOString(),
})

/** The section, or a 404 for one the app does not have. */
export function knownSection(id: string): ProfileSection {
  const section = sectionById(id)
  if (!section) throw new ProfileRequestError(MY_PROFILE_MESSAGES.unknownSection, 404)
  return section
}

/** The fields as the section's schema keeps them, or a 400 saying what is wrong. */
export function checkedFields(section: ProfileSection, fields: unknown): EntryFields {
  const parsed = entrySchema(section).safeParse(fields)
  if (!parsed.success) throw new ProfileRequestError(parsed.error.issues[0]?.message ?? MY_PROFILE_MESSAGES.saveFailed, 400)
  return parsed.data
}

/** Every entry of one section, in the person's order (a new one first). */
export async function listEntries(viewer: Viewer, sectionId: string): Promise<ProfileEntry[]> {
  const section = knownSection(sectionId)
  await connectDatabase()
  const docs = await ProfileEntryModel.find({ ownerId: viewer.id, section: section.id }).sort({ position: 1, createdAt: -1 }).lean()
  return docs.map(toEntry)
}

/** How many entries each section holds, for the counts on the tabs. */
export async function countEntries(viewer: Viewer): Promise<Record<string, number>> {
  await connectDatabase()
  const rows = await ProfileEntryModel.aggregate<{ _id: string; count: number }>([{ $match: { ownerId: viewer.id } }, { $group: { _id: "$section", count: { $sum: 1 } } }])
  return Object.fromEntries(rows.map((row) => [row._id, row.count]))
}

/** Adds entries to the top of a section, in the order given; one is the ordinary case, several an import. */
export async function createEntries(viewer: Viewer, sectionId: string, entries: readonly unknown[]): Promise<ProfileEntry[]> {
  const section = knownSection(sectionId)
  const fields = entries.map((entry) => checkedFields(section, entry))
  await connectDatabase()
  const top = await ProfileEntryModel.findOne({ ownerId: viewer.id, section: section.id }, { position: 1 }).sort({ position: 1 }).lean()
  const first = (top?.position ?? 0) - fields.length
  const docs = await ProfileEntryModel.insertMany(fields.map((value, index) => ({ ownerId: viewer.id, section: section.id, fields: value, position: first + index })))
  return docs.map((doc) => toEntry(doc.toObject() as StoredEntry))
}

/**
 * Replaces one entry's fields. When the text changed, it is waiting to be saved for search again;
 * when nothing changed, it stays as searchable as it was. Null when it is not this person's.
 */
export async function updateEntry(viewer: Viewer, sectionId: string, id: string, fields: unknown): Promise<ProfileEntry | null> {
  const section = knownSection(sectionId)
  const checked = checkedFields(section, fields)
  if (!isValidObjectId(id)) return null
  await connectDatabase()
  const current = await ProfileEntryModel.findOne({ _id: id, ownerId: viewer.id, section: section.id }, { fields: 1 }).lean()
  if (!current) return null
  const isSame = JSON.stringify(current.fields) === JSON.stringify(checked)
  const doc = await ProfileEntryModel.findOneAndUpdate(
    { _id: id, ownerId: viewer.id, section: section.id },
    isSame ? { $set: { fields: checked } } : { $set: { fields: checked, searchStatus: "pending", searchError: null } },
    { returnDocument: "after" }
  ).lean()
  return doc ? toEntry(doc as StoredEntry) : null
}

/** Deletes one entry; false when it was not this person's (or was already gone). */
export async function deleteEntry(viewer: Viewer, sectionId: string, id: string): Promise<boolean> {
  const section = knownSection(sectionId)
  if (!isValidObjectId(id)) return false
  await connectDatabase()
  const result = await ProfileEntryModel.deleteOne({ _id: id, ownerId: viewer.id, section: section.id })
  return result.deletedCount === 1
}

/**
 * Puts a section in the order given. The order must name every entry the section holds, each once:
 * a page that has fallen behind (an entry added or deleted in another tab) is refused with 409
 * rather than guessed at, and nothing is written.
 */
export async function reorderEntries(viewer: Viewer, sectionId: string, orderedIds: readonly string[]): Promise<void> {
  const section = knownSection(sectionId)
  await connectDatabase()
  const ids = (await ProfileEntryModel.find({ ownerId: viewer.id, section: section.id }, { _id: 1 }).lean()).map((doc) => String(doc._id))
  const given = new Set(orderedIds)
  if (given.size !== orderedIds.length || given.size !== ids.length || ids.some((id) => !given.has(id))) {
    throw new ProfileRequestError(MY_PROFILE_MESSAGES.moveFailed, 409)
  }
  await ProfileEntryModel.bulkWrite(
    orderedIds.map((id, position) => ({ updateOne: { filter: { _id: id, ownerId: viewer.id, section: section.id }, update: { $set: { position } }, timestamps: false } }))
  )
}
