import { connectDatabase } from "@/lib/db"
import { ClientProjectFolderModel, type IClientProjectFolder } from "@/models/ClientProjectFolder"
import { ClientProjectTaskModel } from "@/models/ClientProjectTask"
import { escapeForSearch } from "@/lib/listQuery"
import { FolderProblem } from "@/lib/projectFolders"
import {
  MAX_PROJECT_FOLDERS,
  PROJECT_FOLDER_MAX_DEPTH,
  PROJECT_FOLDER_MESSAGES,
  hasFolders,
} from "@/constants/clientProjectTasks"
import type { ProjectFolder, ProjectFolderInput } from "@/types/clientProjectTasks"

/**
 * The folders a project's documents and links are filed in.
 *
 * Every call is scoped by the **project**, never by an account: the caller has already proved which
 * project it may touch (a signed-in viewer through `visibleById`, or the shared link through its
 * token), and holding everything to that one `projectId` is what keeps one project's folders out of
 * another's. It is the same rule the project's items follow (`services/clientProjects/tasks.ts`).
 *
 * The tree is nested, which no other folders in the app are, so three rules are kept here rather
 * than in a route: a name is unique **among its siblings** (two folders called "Invoices" are fine
 * in different places), the tree never goes deeper than `PROJECT_FOLDER_MAX_DEPTH`, and a folder can
 * never be moved inside itself or anything inside it, which would cut that branch off the tree.
 *
 * Nothing is ever lost with a folder: deleting one brings its folders and its items **up one level**
 * (`removeFolder`), the same spirit as every other folder in the app, where deleting one frees what
 * was filed in it.
 */

type StoredFolder = IClientProjectFolder & { _id: { toString: () => string } }



const tidyName = (name: string) => name.replace(/\s+/g, " ").trim()
// Two folders called "Invoices" and "invoices" are the same folder to a reader
const sameName = (name: string) => new RegExp(`^${escapeForSearch(tidyName(name))}$`, "i")

/** Every folder of one project's tab, with where each sits and how much is filed in it. */
export async function listProjectFolders(projectId: string, kind?: string): Promise<ProjectFolder[]> {
  await connectDatabase()
  const filter: Record<string, unknown> = { projectId }
  if (kind) filter.kind = kind
  const [records, counts] = await Promise.all([
    ClientProjectFolderModel.find(filter).sort({ name: 1 }).lean(),
    ClientProjectTaskModel.aggregate<{ _id: string | null; count: number }>([
      { $match: { projectId, folderId: { $ne: null } } },
      { $group: { _id: "$folderId", count: { $sum: 1 } } },
    ]),
  ])
  const stored = records as unknown as StoredFolder[]
  const byId = new Map(stored.map((record) => [record._id.toString(), record]))
  const direct = new Map<string, number>(counts.map((row) => [String(row._id), row.count]))

  /** How far down the tree a folder is, counted by walking up. A parent that is gone reads as the top. */
  const depthOf = (record: StoredFolder): number => {
    let depth = 0
    let parentId = record.parentId
    while (parentId && depth < PROJECT_FOLDER_MAX_DEPTH + 1) {
      const parent = byId.get(parentId)
      if (!parent) break
      depth += 1
      parentId = parent.parentId
    }
    return depth
  }

  const childrenOf = new Map<string, StoredFolder[]>()
  for (const record of stored) {
    const key = record.parentId ?? "root"
    const list = childrenOf.get(key)
    if (list) list.push(record)
    else childrenOf.set(key, [record])
  }
  /** What is filed in a folder and in everything inside it, so a closed folder still says its size. */
  const totalOf = (record: StoredFolder, seen = new Set<string>()): number => {
    const id = record._id.toString()
    if (seen.has(id)) return 0
    seen.add(id)
    const own = direct.get(id) ?? 0
    const inside = (childrenOf.get(id) ?? []).reduce((sum, child) => sum + totalOf(child, seen), 0)
    return own + inside
  }

  return stored.map((record) => ({
    id: record._id.toString(),
    projectId: record.projectId,
    kind: record.kind,
    name: record.name,
    parentId: record.parentId ?? null,
    depth: depthOf(record),
    itemCount: direct.get(record._id.toString()) ?? 0,
    totalItemCount: totalOf(record),
  }))
}

/** One folder of this project, or null when the id names none of them. */
async function folderOrNull(projectId: string, folderId: string): Promise<StoredFolder | null> {
  if (!/^[0-9a-f]{24}$/.test(folderId)) return null
  await connectDatabase()
  const record = await ClientProjectFolderModel.findOne({ _id: folderId, projectId }).lean()
  return (record as unknown as StoredFolder) ?? null
}

/**
 * The folder an item may be filed in: its id when it belongs to this project and this tab, null for
 * the top of the tree. Throws when the id names a folder that is gone or another project's, so an
 * item is never quietly filed nowhere.
 */
export async function folderForItem(projectId: string, kind: string, folderId: string | null | undefined): Promise<string | null> {
  if (!folderId) return null
  const folder = await folderOrNull(projectId, folderId)
  if (!folder || folder.kind !== kind) throw new FolderProblem(PROJECT_FOLDER_MESSAGES.notFound)
  return folderId
}

/** How deep a folder would be under this parent, with the parent checked to be this project's tab. */
async function depthUnder(projectId: string, kind: string, parentId: string | null): Promise<number> {
  if (!parentId) return 0
  const folders = await listProjectFolders(projectId, kind)
  const parent = folders.find((folder) => folder.id === parentId)
  if (!parent) throw new FolderProblem(PROJECT_FOLDER_MESSAGES.notFound)
  return parent.depth + 1
}

/** Adds a folder to one tab of one project, at the top or inside another. */
export async function createProjectFolder(
  projectId: string,
  ownerId: string | null,
  input: ProjectFolderInput
): Promise<ProjectFolder> {
  if (!hasFolders(input.kind)) throw new FolderProblem(PROJECT_FOLDER_MESSAGES.notFound)
  const name = tidyName(input.name)
  if (!name) throw new FolderProblem(PROJECT_FOLDER_MESSAGES.missingName)
  await connectDatabase()
  const parentId = input.parentId ?? null
  const depth = await depthUnder(projectId, input.kind, parentId)
  if (depth >= PROJECT_FOLDER_MAX_DEPTH) throw new FolderProblem(PROJECT_FOLDER_MESSAGES.tooDeep)
  if ((await ClientProjectFolderModel.countDocuments({ projectId, kind: input.kind })) >= MAX_PROJECT_FOLDERS) {
    throw new FolderProblem(PROJECT_FOLDER_MESSAGES.tooMany)
  }
  // Unique among its siblings only: the same name in two different places is two different folders
  if (await ClientProjectFolderModel.exists({ projectId, kind: input.kind, parentId, name: sameName(name) })) {
    throw new FolderProblem(PROJECT_FOLDER_MESSAGES.duplicate)
  }
  const record = await ClientProjectFolderModel.create({ ownerId, projectId, kind: input.kind, name, parentId })
  const stored = record as unknown as StoredFolder
  return {
    id: stored._id.toString(),
    projectId,
    kind: input.kind,
    name,
    parentId,
    depth,
    itemCount: 0,
    totalItemCount: 0,
  }
}

/** Every folder inside this one, however deep, including itself. */
async function branchOf(projectId: string, folderId: string): Promise<string[]> {
  const folders = await listProjectFolders(projectId)
  const branch = [folderId]
  for (let index = 0; index < branch.length; index += 1) {
    for (const folder of folders) {
      if (folder.parentId === branch[index] && !branch.includes(folder.id)) branch.push(folder.id)
    }
  }
  return branch
}

/**
 * Renames a folder, moves it under another, or both. A folder can never be moved inside itself or
 * inside anything that is already inside it, and the move is refused when it would push the branch
 * past the depth the tree allows, rather than silently flattening it.
 */
export async function changeProjectFolder(
  projectId: string,
  folderId: string,
  changes: { name?: string; parentId?: string | null }
): Promise<ProjectFolder | null> {
  const folder = await folderOrNull(projectId, folderId)
  if (!folder) return null
  const update: Record<string, unknown> = {}

  if (changes.parentId !== undefined) {
    const parentId = changes.parentId ?? null
    if (parentId === folderId) throw new FolderProblem(PROJECT_FOLDER_MESSAGES.intoItself)
    const branch = await branchOf(projectId, folderId)
    if (parentId && branch.includes(parentId)) throw new FolderProblem(PROJECT_FOLDER_MESSAGES.intoItself)
    const depth = await depthUnder(projectId, folder.kind, parentId)
    // The deepest folder in the branch decides: moving a folder takes everything under it along
    const all = await listProjectFolders(projectId, folder.kind)
    const here = all.find((entry) => entry.id === folderId)
    const deepest = all
      .filter((entry) => branch.includes(entry.id))
      .reduce((most, entry) => Math.max(most, entry.depth - (here?.depth ?? 0)), 0)
    if (depth + deepest >= PROJECT_FOLDER_MAX_DEPTH) throw new FolderProblem(PROJECT_FOLDER_MESSAGES.tooDeep)
    update.parentId = parentId
  }

  if (changes.name !== undefined) {
    const name = tidyName(changes.name)
    if (!name) throw new FolderProblem(PROJECT_FOLDER_MESSAGES.missingName)
    const parentId = (update.parentId as string | null | undefined) ?? folder.parentId ?? null
    const clash = await ClientProjectFolderModel.exists({
      projectId,
      kind: folder.kind,
      parentId,
      name: sameName(name),
      _id: { $ne: folderId },
    })
    if (clash) throw new FolderProblem(PROJECT_FOLDER_MESSAGES.duplicate)
    update.name = name
  }

  if (Object.keys(update).length === 0) return null
  await ClientProjectFolderModel.updateOne({ _id: folderId, projectId }, { $set: update })
  const folders = await listProjectFolders(projectId, folder.kind)
  return folders.find((entry) => entry.id === folderId) ?? null
}

/**
 * Deletes one folder and brings what was inside it **up one level**: its own folders take its
 * parent, and the items filed in it are filed where it was. Nothing is deleted but the folder, so a
 * mistaken delete costs a name rather than the work.
 */
export async function removeProjectFolder(projectId: string, folderId: string): Promise<{ folders: number; items: number } | null> {
  const folder = await folderOrNull(projectId, folderId)
  if (!folder) return null
  const parentId = folder.parentId ?? null
  const [{ modifiedCount: folders }, { modifiedCount: items }] = await Promise.all([
    ClientProjectFolderModel.updateMany({ projectId, parentId: folderId }, { $set: { parentId } }),
    ClientProjectTaskModel.updateMany({ projectId, folderId }, { $set: { folderId: parentId } }),
  ])
  await ClientProjectFolderModel.deleteOne({ _id: folderId, projectId })
  return { folders, items }
}

/** Deletes every folder of these projects, for a project, a client or an account that is going. */
export async function deleteFoldersOfProjects(projectIds: readonly string[]): Promise<number> {
  if (projectIds.length === 0) return 0
  await connectDatabase()
  const { deletedCount } = await ClientProjectFolderModel.deleteMany({ projectId: { $in: [...projectIds] } })
  return deletedCount
}

// The tree's own error type lives in lib/projectFolders.ts, where nothing needs the environment;
// it is re-exported here because every caller of this service throws and catches it.
export { FolderProblem }
