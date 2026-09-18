import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { escapeForSearch } from "@/lib/listQuery"
import { CreatedPromptModel } from "@/models/CreatedPrompt"
import { PromptFolderModel, type IPromptFolder } from "@/models/PromptFolder"
import { MAX_FOLDERS, PROMPT_FOLDER_MESSAGES } from "@/constants/promptFolders"
import type { PromptFolder } from "@/types/promptFolders"
import type { Viewer } from "@/types/auth"
import { visibleById, visibleTo } from "@/services/auth/viewer"

/**
 * The folders an account keeps its created prompts in.
 *
 * A folder holds nothing itself: each prompt carries the id of the folder it is in (`folderId` on
 * `created_prompts`, null for one in no folder). So moving a prompt is one small write on the
 * prompt, and deleting a folder only frees its prompts rather than deleting anything they hold.
 */

type StoredFolder = Pick<IPromptFolder, "name"> & { _id: { toString: () => string } }

const toFolder = (record: StoredFolder, promptCount: number): PromptFolder => ({
  id: record._id.toString(),
  name: record.name,
  promptCount,
})

// Two folders called "Client work" and "client work" would be the same folder to a reader
const sameName = (name: string) => new RegExp(`^${escapeForSearch(name)}$`, "i")

/** Every folder the viewer may see, by name, each with how many prompts are in it. */
export async function listFolders(viewer: Viewer): Promise<PromptFolder[]> {
  await connectDatabase()
  const scope = visibleTo(viewer)
  const [records, counts] = await Promise.all([
    PromptFolderModel.find(scope, { name: 1 }).sort({ name: 1 }).lean(),
    CreatedPromptModel.aggregate<{ _id: string | null; count: number }>([
      { $match: { ...scope, folderId: { $ne: null } } },
      { $group: { _id: "$folderId", count: { $sum: 1 } } },
    ]),
  ])
  const byFolder = new Map(counts.map((row) => [String(row._id), row.count]))
  const stored = records as unknown as StoredFolder[]
  return stored.map((record) => toFolder(record, byFolder.get(record._id.toString()) ?? 0))
}

/** Adds a folder. A name another folder already has is refused rather than made twice. */
export async function createFolder(viewer: Viewer, name: string): Promise<PromptFolder> {
  await connectDatabase()
  const scope = visibleTo(viewer)
  if ((await PromptFolderModel.countDocuments(scope)) >= MAX_FOLDERS) throw new UserFacingError(PROMPT_FOLDER_MESSAGES.tooMany)
  if (await PromptFolderModel.exists({ ...scope, name: sameName(name) })) throw new UserFacingError(PROMPT_FOLDER_MESSAGES.duplicate)
  const record = await PromptFolderModel.create({ ownerId: viewer.id, name })
  return toFolder(record.toObject() as unknown as StoredFolder, 0)
}

/** Renames one folder. Null when it is gone or belongs to another account. */
export async function renameFolder(viewer: Viewer, id: string, name: string): Promise<PromptFolder | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const scope = visibleTo(viewer)
  if (await PromptFolderModel.exists({ ...scope, _id: { $ne: new mongoose.Types.ObjectId(id) }, name: sameName(name) })) {
    throw new UserFacingError(PROMPT_FOLDER_MESSAGES.duplicate)
  }
  const record = (await PromptFolderModel.findOneAndUpdate(filter, { name }, { returnDocument: "after" }).lean()) as unknown as StoredFolder | null
  if (!record) return null
  const promptCount = await CreatedPromptModel.countDocuments({ ...scope, folderId: id })
  return toFolder(record, promptCount)
}

/**
 * Deletes one folder and takes its prompts out of it. The prompts themselves are kept, and show
 * under "No folder" afterwards. Returns how many prompts were freed, or null when the folder is
 * gone or belongs to another account.
 */
export async function deleteFolder(viewer: Viewer, id: string): Promise<{ freed: number } | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const { deletedCount } = await PromptFolderModel.deleteOne(filter)
  if (deletedCount === 0) return null
  // The prompts go back to no folder, whoever owns them among those the viewer may see
  const { modifiedCount } = await CreatedPromptModel.updateMany({ ...visibleTo(viewer), folderId: id }, { $set: { folderId: null } })
  return { freed: modifiedCount }
}

/**
 * The folder a project files its prompts in: the one it is already linked to while that still
 * exists, otherwise the viewer's folder with the project's name (whatever its case, so a folder the
 * user made by hand is used rather than a second one beside it), otherwise a new folder with that
 * name. Null only when the account already has MAX_FOLDERS folders, in which case the prompt is
 * simply saved in no folder rather than failing.
 */
export async function folderForProjectName(viewer: Viewer, name: string, linkedId: string | null): Promise<string | null> {
  await connectDatabase()
  const scope = visibleTo(viewer)
  const linked = linkedId ? visibleById(viewer, linkedId) : null
  if (linked && (await PromptFolderModel.exists(linked))) return linkedId
  const sameNamed = (await PromptFolderModel.findOne({ ...scope, name: sameName(name) }, { _id: 1 }).lean()) as unknown as StoredFolder | null
  if (sameNamed) return sameNamed._id.toString()
  if ((await PromptFolderModel.countDocuments(scope)) >= MAX_FOLDERS) return null
  const record = await PromptFolderModel.create({ ownerId: viewer.id, name })
  return record._id.toString()
}

/** The folder a prompt may be moved into: its id when the viewer may use it, null for no folder. */
export async function folderForMove(viewer: Viewer, folderId: string | null): Promise<string | null> {
  if (!folderId) return null
  const filter = visibleById(viewer, folderId)
  if (!filter) throw new UserFacingError(PROMPT_FOLDER_MESSAGES.notFound)
  await connectDatabase()
  if (!(await PromptFolderModel.exists(filter))) throw new UserFacingError(PROMPT_FOLDER_MESSAGES.notFound)
  return folderId
}

/** Each folder's name by id, for showing which folder a prompt is in. */
export async function folderNames(viewer: Viewer): Promise<Map<string, string>> {
  await connectDatabase()
  const records = (await PromptFolderModel.find(visibleTo(viewer), { name: 1 }).lean()) as unknown as StoredFolder[]
  return new Map(records.map((record) => [record._id.toString(), record.name]))
}
