import { UserFacingError } from "@/lib/errors"

/**
 * A folder tree: the rules for reading one, with nothing in them from the database or the page.
 *
 * Two modules keep nested folders now. A client project files its documents and links in them
 * (`client_project_folders`), and Personal Drive files every stored file in them (`asset_folders`),
 * which is what a drive is. They are the only nested folders in the app: Prompt Creator's and
 * Important Content's are one flat list each.
 *
 * Both read the same shape, so the walking is written once here. Everything below needs only a
 * folder's id, its parent and its depth, which is why `FolderNode` says so little: each module's
 * own folder type (`ProjectFolder`, `DriveFolder`) is that shape plus whatever it counts.
 *
 * Both walkers are written to stop rather than loop: a record that somehow points at its own parent
 * is a broken row, not a reason to hang the page.
 */

export interface FolderNode {
  id: string
  name: string
  parentId: string | null
  // How far down the tree it sits, 0 at the top, worked out when the folders are read
  depth: number
}

/**
 * Something about the tree the caller can put right: a name already used beside it, a folder too
 * deep, a folder moved inside itself, or an id that names no folder of this account.
 *
 * It extends `UserFacingError`, so **every route answers it as 400 with its own message**, including
 * the ones that know nothing about folders: moving a record is one field on its own PUT, and that
 * route's existing `UserFacingError` branch is what makes a bad folder read as "that folder no
 * longer exists" rather than a 500.
 */
export class FolderProblem extends UserFacingError {}

/**
 * A folder and everything inside it, however deep: what a list and a search are scoped to.
 *
 * The top of the tree (`null`) is **its own place**, not every folder: a record in no folder sits
 * there, and opening the top shows those records rather than everything the account has. That is
 * what makes "this folder" mean something on every row of the tree.
 */
export function folderBranch(folders: readonly FolderNode[], folderId: string | null): Set<string | null> {
  const branch = new Set<string | null>([folderId])
  if (folderId === null) return branch
  const ids = [folderId]
  for (let index = 0; index < ids.length; index += 1) {
    for (const folder of folders) {
      if (folder.parentId === ids[index] && !ids.includes(folder.id)) {
        ids.push(folder.id)
        branch.add(folder.id)
      }
    }
  }
  return branch
}

/** The path to a folder, the top one first, for the line above the list. */
export function folderPath<T extends FolderNode>(folders: readonly T[], folderId: string | null): T[] {
  const path: T[] = []
  const seen = new Set<string>()
  let current = folders.find((folder) => folder.id === folderId)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    path.unshift(current)
    const parentId = current.parentId
    current = parentId ? folders.find((folder) => folder.id === parentId) : undefined
  }
  return path
}

/** The folders directly inside one, in the order they were read; the top of the tree is `null`. */
export const childFolders = <T extends FolderNode>(folders: readonly T[], parentId: string | null): T[] =>
  folders.filter((folder) => (folder.parentId ?? null) === parentId)
