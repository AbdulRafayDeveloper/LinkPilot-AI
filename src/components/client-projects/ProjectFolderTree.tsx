"use client"

import React from "react"
import { FolderTree } from "@/components/folders/FolderTree"
import { PROJECT_FOLDER_MESSAGES, PROJECT_FOLDER_MAX_DEPTH } from "@/constants/clientProjectTasks"
import { folderBranch, folderPath } from "@/lib/projectFolders"
import type { ProjectFolder } from "@/types/clientProjectTasks"

interface ProjectFolderTreeProps {
  folders: ProjectFolder[]
  // Which folder is open; null is the top of the tree, where the items in no folder are
  selectedId: string | null
  // How many items sit at the top, so the top row says its own count like every folder
  rootCount: number
  busyId?: string | null
  onSelect: (folderId: string | null) => void
  onCreate: (parentId: string | null) => void
  onRename: (folder: ProjectFolder) => void
  onDelete: (folder: ProjectFolder) => void
}

/**
 * The folder tree of one tab, in this project's own words.
 *
 * The tree itself is `components/folders/FolderTree`, shared with Personal Drive, which files every
 * stored file the same way; this is the project's own copy and depth passed to it. Items are filed
 * from the Move dialog here rather than by dragging, so nothing on it is a drop target.
 */
export const ProjectFolderTree: React.FC<ProjectFolderTreeProps> = ({
  folders,
  selectedId,
  rootCount,
  busyId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}) => (
  <FolderTree
    folders={folders}
    selectedId={selectedId}
    rootCount={rootCount}
    totalOf={(folder) => folder.totalItemCount}
    copy={PROJECT_FOLDER_MESSAGES}
    maxDepth={PROJECT_FOLDER_MAX_DEPTH}
    busyId={busyId}
    onSelect={onSelect}
    onCreate={onCreate}
    onRename={onRename}
    onDelete={onDelete}
  />
)

// The tree's own rules live in lib/folderTree.ts, where they are tested on their own; they are
// re-exported here because every page that draws the tree also needs them.
export { folderBranch, folderPath }
