import { UserFacingError } from "@/lib/errors"
import type { ProjectFolder } from "@/types/clientProjectTasks"

/**
 * Something about the tree the caller can put right: a name already used beside it, a folder too
 * deep, a folder moved inside itself, or an id that names no folder of this project.
 *
 * It extends `UserFacingError`, so **every route answers it as 400 with its own message**, including
 * the ones that know nothing about folders: moving an item is one field on the item's own PUT, and
 * that route's existing `UserFacingError` branch is what makes a bad folder read as "that folder no
 * longer exists" rather than a 500. It lives here rather than in the service because this file is
 * the tree's rules and needs nothing from the environment.
 */
export class FolderProblem extends UserFacingError {}

/**
 * Reading a project's folder tree: which folders are inside which, and the path to one.
 *
 * Kept out of the component and out of the database, like `lib/projectItems.ts` and
 * `lib/taskTree.ts`, so the rules of the tree can be reasoned about and tested on their own. Both
 * walkers are written to stop rather than loop: a record that somehow points at its own parent is a
 * broken row, not a reason to hang the page.
 */

/**
 * A folder and everything inside it, however deep: what a list and a search are scoped to.
 *
 * The top of the tree (`null`) is **its own place**, not every folder: an item in no folder sits
 * there, and opening the top shows those items rather than the whole project. That is what makes
 * "this folder" mean something on every row of the tree.
 */
export function folderBranch(folders: readonly ProjectFolder[], folderId: string | null): Set<string | null> {
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
export function folderPath(folders: readonly ProjectFolder[], folderId: string | null): ProjectFolder[] {
  const path: ProjectFolder[] = []
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

/** The folders directly inside one, by name; the top of the tree is `null`. */
export const childFolders = (folders: readonly ProjectFolder[], parentId: string | null): ProjectFolder[] =>
  folders.filter((folder) => (folder.parentId ?? null) === parentId)
