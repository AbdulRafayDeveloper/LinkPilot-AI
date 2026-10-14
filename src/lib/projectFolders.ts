import { childFolders, FolderProblem, folderBranch, folderPath } from "@/lib/folderTree"

/**
 * Reading a project's folder tree.
 *
 * The rules themselves are `lib/folderTree.ts`, shared with Personal Drive, which files every
 * stored file the same way. They used to live here, when a client project was the only nested tree
 * in the app; this file stays as the name every client-projects caller already imports, so that one
 * module reads as it always did and nothing about it had to change.
 */

export { childFolders, FolderProblem, folderBranch, folderPath }
export type { FolderNode } from "@/lib/folderTree"
