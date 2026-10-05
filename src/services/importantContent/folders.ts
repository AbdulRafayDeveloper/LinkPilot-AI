import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { escapeForSearch } from "@/lib/listQuery"
import { ContentFolderModel, type IContentFolder } from "@/models/ContentFolder"
import { ImportantContentModel } from "@/models/ImportantContent"
import { CONTENT_FOLDER_MESSAGES, MAX_FOLDERS } from "@/constants/contentFolders"
import type { RecordFolder } from "@/types/folders"
import type { Viewer } from "@/types/auth"
import { visibleById, visibleTo } from "@/services/auth/viewer"

/**
 * The folders an account files its Important Content entries in, the same rules Prompt Creator's
 * folders follow (`services/promptCreator/folders.ts`): a folder holds nothing itself, each entry
 * carries the id of the folder it is in, so moving an entry is one small write and deleting a
 * folder only frees its entries. Its own collection, so the two modules' folders never mix.
 */

type StoredFolder = Pick<IContentFolder, "name"> & { _id: { toString: () => string } }

const toFolder = (record: StoredFolder, recordCount: number): RecordFolder => ({
  id: record._id.toString(),
  name: record.name,
  recordCount,
})

// Two folders called "Client logins" and "client logins" would be the same folder to a reader
const sameName = (name: string) => new RegExp(`^${escapeForSearch(name)}$`, "i")

/** Every folder the viewer may see, by name, each with how many entries are in it. */
export async function listFolders(viewer: Viewer): Promise<RecordFolder[]> {
  await connectDatabase()
  const scope = visibleTo(viewer)
  const [records, counts] = await Promise.all([
    ContentFolderModel.find(scope, { name: 1 }).sort({ name: 1 }).lean(),
    ImportantContentModel.aggregate<{ _id: string | null; count: number }>([
      { $match: { ...scope, folderId: { $ne: null } } },
      { $group: { _id: "$folderId", count: { $sum: 1 } } },
    ]),
  ])
  const byFolder = new Map(counts.map((row) => [String(row._id), row.count]))
  const stored = records as unknown as StoredFolder[]
  return stored.map((record) => toFolder(record, byFolder.get(record._id.toString()) ?? 0))
}

/** Adds a folder. A name another folder already has is refused rather than made twice. */
export async function createFolder(viewer: Viewer, name: string): Promise<RecordFolder> {
  await connectDatabase()
  const scope = visibleTo(viewer)
  if ((await ContentFolderModel.countDocuments(scope)) >= MAX_FOLDERS) throw new UserFacingError(CONTENT_FOLDER_MESSAGES.tooMany)
  if (await ContentFolderModel.exists({ ...scope, name: sameName(name) })) throw new UserFacingError(CONTENT_FOLDER_MESSAGES.duplicate)
  const record = await ContentFolderModel.create({ ownerId: viewer.id, name })
  return toFolder(record.toObject() as unknown as StoredFolder, 0)
}

/** Renames one folder. Null when it is gone or belongs to another account. */
export async function renameFolder(viewer: Viewer, id: string, name: string): Promise<RecordFolder | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const scope = visibleTo(viewer)
  if (await ContentFolderModel.exists({ ...scope, _id: { $ne: new mongoose.Types.ObjectId(id) }, name: sameName(name) })) {
    throw new UserFacingError(CONTENT_FOLDER_MESSAGES.duplicate)
  }
  const record = (await ContentFolderModel.findOneAndUpdate(filter, { name }, { returnDocument: "after" }).lean()) as unknown as StoredFolder | null
  if (!record) return null
  const recordCount = await ImportantContentModel.countDocuments({ ...scope, folderId: id })
  return toFolder(record, recordCount)
}

/**
 * Deletes one folder and takes its entries out of it. The entries themselves are kept, and show
 * under "No folder" afterwards. Returns how many were freed, or null when the folder is gone or
 * belongs to another account.
 */
export async function deleteFolder(viewer: Viewer, id: string): Promise<{ freed: number } | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const { deletedCount } = await ContentFolderModel.deleteOne(filter)
  if (deletedCount === 0) return null
  // The entries go back to no folder, whoever owns them among those the viewer may see
  const { modifiedCount } = await ImportantContentModel.updateMany({ ...visibleTo(viewer), folderId: id }, { $set: { folderId: null } })
  return { freed: modifiedCount }
}

/** The folder an entry may be filed in: its id when the viewer may use it, null for no folder. */
export async function folderForMove(viewer: Viewer, folderId: string | null): Promise<string | null> {
  if (!folderId) return null
  const filter = visibleById(viewer, folderId)
  if (!filter) throw new UserFacingError(CONTENT_FOLDER_MESSAGES.notFound)
  await connectDatabase()
  if (!(await ContentFolderModel.exists(filter))) throw new UserFacingError(CONTENT_FOLDER_MESSAGES.notFound)
  return folderId
}

/** Each folder's name by id, for showing which folder an entry is in and for the folder filters. */
export async function folderNames(viewer: Viewer): Promise<Map<string, string>> {
  await connectDatabase()
  const records = (await ContentFolderModel.find(visibleTo(viewer), { name: 1 }).lean()) as unknown as StoredFolder[]
  return new Map(records.map((record) => [record._id.toString(), record.name]))
}
