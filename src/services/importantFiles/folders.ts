import { connectDatabase } from "@/lib/db"
import { AssetFolder, type IAssetFolder } from "@/models/AssetFolder"
import { AssetFile } from "@/models/AssetFile"
import { escapeForSearch } from "@/lib/listQuery"
import { FolderProblem } from "@/lib/folderTree"
import {
  DRIVE_FOLDER_MAX_DEPTH,
  DRIVE_FOLDER_MESSAGES,
  MAX_DRIVE_FOLDERS,
} from "@/constants/importantFiles"
import type { DriveFolder, DriveFolderChange, DriveFolderInput } from "@/types/importantFiles"
import type { Viewer } from "@/types/auth"
import { ownedBy, visibleTo } from "@/services/auth/viewer"

/**
 * The folders Personal Drive files its files in.
 *
 * Every call is scoped by the **account**, through the same `visibleTo` / `ownedBy` helpers every
 * other module reads with, so one account can never reach another's tree and a child account works
 * inside its parent's drive like it does everywhere else.
 *
 * The tree is nested, so three rules are kept here rather than in a route: a name is unique **among
 * its siblings** (two folders called "Invoices" are fine in different places, as on any computer),
 * the tree never goes deeper than `DRIVE_FOLDER_MAX_DEPTH`, and a folder can never be moved inside
 * itself or anything inside it, which would cut that branch off the tree.
 *
 * **Nothing is ever lost with a folder:** deleting one brings its folders and its files up one
 * level, which is the rule every other folder in the app follows.
 */

type StoredFolder = IAssetFolder & { _id: { toString: () => string } }

const ID_PATTERN = /^[0-9a-f]{24}$/

const tidyName = (name: string) => name.replace(/\s+/g, " ").trim()
// Two folders called "Invoices" and "invoices" are the same folder to a reader
const sameName = (name: string) => new RegExp(`^${escapeForSearch(tidyName(name))}$`, "i")

/**
 * Every folder the viewer has, with where each sits and how much is filed in it.
 *
 * The counts come from one grouped query over the files, never one query per folder, and a closed
 * folder reports what is inside it altogether (`totalFileCount`), so a count can never disagree
 * with what opening the folder shows.
 */
export async function listDriveFolders(viewer: Viewer): Promise<DriveFolder[]> {
  await connectDatabase()
  const [records, counts] = await Promise.all([
    AssetFolder.find(visibleTo(viewer)).sort({ name: 1 }).lean(),
    AssetFile.aggregate<{ _id: string | null; count: number }>([
      { $match: { $and: [visibleTo(viewer), { status: "ready" }, { folderId: { $ne: null } }] } },
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
    while (parentId && depth < DRIVE_FOLDER_MAX_DEPTH + 1) {
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
  /** What is in a folder and in everything inside it, so a closed folder still says its size. */
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
    name: record.name,
    parentId: record.parentId ?? null,
    depth: depthOf(record),
    fileCount: direct.get(record._id.toString()) ?? 0,
    totalFileCount: totalOf(record),
  }))
}

/** How many files sit at the top of the drive, in no folder at all. */
export async function rootFileCount(viewer: Viewer): Promise<number> {
  await connectDatabase()
  return AssetFile.countDocuments({ $and: [visibleTo(viewer), { status: "ready", folderId: null }] })
}

/** One folder of this account, or null when the id names none of them. */
async function folderOrNull(viewer: Viewer, folderId: string): Promise<StoredFolder | null> {
  if (!ID_PATTERN.test(folderId)) return null
  await connectDatabase()
  const record = await AssetFolder.findOne({ $and: [visibleTo(viewer), { _id: folderId }] }).lean()
  return (record as unknown as StoredFolder) ?? null
}

/**
 * The folder a file may be filed in: its id when the viewer really has that folder, null for the
 * top of the drive. It throws rather than filing the file nowhere, so a folder deleted in another
 * tab is reported instead of quietly moving the file to the top.
 */
export async function folderForAsset(viewer: Viewer, folderId: string | null | undefined): Promise<string | null> {
  if (!folderId) return null
  const folder = await folderOrNull(viewer, folderId)
  if (!folder) throw new FolderProblem(DRIVE_FOLDER_MESSAGES.notFound)
  return folderId
}

/** How deep a folder would be under this parent, with the parent checked to be the viewer's. */
async function depthUnder(viewer: Viewer, parentId: string | null): Promise<number> {
  if (!parentId) return 0
  const folders = await listDriveFolders(viewer)
  const parent = folders.find((folder) => folder.id === parentId)
  if (!parent) throw new FolderProblem(DRIVE_FOLDER_MESSAGES.notFound)
  return parent.depth + 1
}

/** Adds a folder, at the top of the drive or inside another. */
export async function createDriveFolder(viewer: Viewer, input: DriveFolderInput): Promise<DriveFolder> {
  const name = tidyName(input.name)
  if (!name) throw new FolderProblem(DRIVE_FOLDER_MESSAGES.missingName)
  await connectDatabase()
  const parentId = input.parentId ?? null
  const depth = await depthUnder(viewer, parentId)
  if (depth >= DRIVE_FOLDER_MAX_DEPTH) throw new FolderProblem(DRIVE_FOLDER_MESSAGES.tooDeep)
  if ((await AssetFolder.countDocuments(ownedBy(viewer))) >= MAX_DRIVE_FOLDERS) {
    throw new FolderProblem(DRIVE_FOLDER_MESSAGES.tooMany)
  }
  // Unique among its siblings only: the same name in two different places is two different folders
  if (await AssetFolder.exists({ $and: [visibleTo(viewer), { parentId, name: sameName(name) }] })) {
    throw new FolderProblem(DRIVE_FOLDER_MESSAGES.duplicate)
  }
  const record = (await AssetFolder.create({ ownerId: viewer.id, name, parentId })) as unknown as StoredFolder
  return { id: record._id.toString(), name, parentId, depth, fileCount: 0, totalFileCount: 0 }
}

/** Every folder inside this one, however deep, including itself. */
async function branchOf(viewer: Viewer, folderId: string): Promise<string[]> {
  const folders = await listDriveFolders(viewer)
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
 * inside anything already inside it, and the move is refused when it would push the branch past the
 * depth the tree allows, rather than silently flattening it.
 */
export async function changeDriveFolder(viewer: Viewer, folderId: string, changes: DriveFolderChange): Promise<DriveFolder | null> {
  const folder = await folderOrNull(viewer, folderId)
  if (!folder) return null
  const update: Record<string, unknown> = {}

  if (changes.parentId !== undefined) {
    const parentId = changes.parentId ?? null
    if (parentId === folderId) throw new FolderProblem(DRIVE_FOLDER_MESSAGES.intoItself)
    const branch = await branchOf(viewer, folderId)
    if (parentId && branch.includes(parentId)) throw new FolderProblem(DRIVE_FOLDER_MESSAGES.intoItself)
    const depth = await depthUnder(viewer, parentId)
    // The deepest folder in the branch decides: moving a folder takes everything under it along
    const all = await listDriveFolders(viewer)
    const here = all.find((entry) => entry.id === folderId)
    const deepest = all
      .filter((entry) => branch.includes(entry.id))
      .reduce((most, entry) => Math.max(most, entry.depth - (here?.depth ?? 0)), 0)
    if (depth + deepest >= DRIVE_FOLDER_MAX_DEPTH) throw new FolderProblem(DRIVE_FOLDER_MESSAGES.tooDeep)
    update.parentId = parentId
  }

  if (changes.name !== undefined) {
    const name = tidyName(changes.name)
    if (!name) throw new FolderProblem(DRIVE_FOLDER_MESSAGES.missingName)
    const parentId = (update.parentId as string | null | undefined) ?? folder.parentId ?? null
    const clash = await AssetFolder.exists({
      $and: [visibleTo(viewer), { parentId, name: sameName(name), _id: { $ne: folderId } }],
    })
    if (clash) throw new FolderProblem(DRIVE_FOLDER_MESSAGES.duplicate)
    update.name = name
  }

  if (Object.keys(update).length === 0) return null
  await AssetFolder.updateOne({ $and: [visibleTo(viewer), { _id: folderId }] }, { $set: update })
  const folders = await listDriveFolders(viewer)
  return folders.find((entry) => entry.id === folderId) ?? null
}

/**
 * Deletes one folder and brings what was inside it **up one level**: its own folders take its
 * parent, and the files filed in it are filed where it was. Nothing is deleted but the folder, so a
 * mistaken delete costs a name rather than the files, and no file is ever removed from storage here.
 */
export async function removeDriveFolder(viewer: Viewer, folderId: string): Promise<{ folders: number; files: number } | null> {
  const folder = await folderOrNull(viewer, folderId)
  if (!folder) return null
  const parentId = folder.parentId ?? null
  const [{ modifiedCount: folders }, { modifiedCount: files }] = await Promise.all([
    AssetFolder.updateMany({ $and: [visibleTo(viewer), { parentId: folderId }] }, { $set: { parentId } }),
    AssetFile.updateMany({ $and: [visibleTo(viewer), { folderId }] }, { $set: { folderId: parentId } }),
  ])
  await AssetFolder.deleteOne({ $and: [visibleTo(viewer), { _id: folderId }] })
  return { folders, files }
}

// The tree's own error type lives in lib/folderTree.ts, where nothing needs the environment; it is
// re-exported here because every caller of this service throws and catches it.
export { FolderProblem }
