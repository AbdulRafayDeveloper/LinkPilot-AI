"use client"

import React, { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Folder, FolderOpen, FolderPlus, Loader2, Pencil, Trash2 } from "lucide-react"
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
 * The folder tree of one tab: the top of the tree, then every folder under it, each with how much
 * is filed in it and in the folders inside it.
 *
 * It is the app's only **nested** folder list, so two things are its own rather than the shared
 * folder pieces': a row can be opened and closed (`ChevronRight`), and New folder sits on every
 * row, because a folder inside a folder is the point of it. Everything else reads like the rest of
 * the app: one row is selected, the selected row is a filled tile, and the counts are grey.
 *
 * **Nothing is hidden by a closed row.** A closed folder still says how many items are inside it
 * altogether, so a count never disagrees with what opening it shows.
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
}) => {
  // Which rows are open. A folder on the way to the selected one is open whatever is remembered
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())

  const childrenOf = useMemo(() => {
    const map = new Map<string, ProjectFolder[]>()
    for (const folder of folders) {
      const key = folder.parentId ?? "root"
      const list = map.get(key)
      if (list) list.push(folder)
      else map.set(key, [folder])
    }
    return map
  }, [folders])

  // The folders from the top down to the selected one, so its parents are never closed over it
  const openPath = useMemo(() => {
    const path = new Set<string>()
    let current = folders.find((folder) => folder.id === selectedId)
    while (current?.parentId) {
      path.add(current.parentId)
      const parentId: string = current.parentId
      current = folders.find((folder) => folder.id === parentId)
    }
    return path
  }, [folders, selectedId])

  const toggle = (id: string) =>
    setClosed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const rowFor = (folder: ProjectFolder): React.ReactNode => {
    const children = childrenOf.get(folder.id) ?? []
    const isOpen = !closed.has(folder.id) || openPath.has(folder.id)
    const isSelected = folder.id === selectedId
    const canNest = folder.depth + 1 < PROJECT_FOLDER_MAX_DEPTH
    return (
      <li key={folder.id}>
        <div
          className={`group flex items-center gap-1 rounded-lg pr-1 transition-colors ${
            isSelected ? "bg-primary-container text-on-primary-container" : "hover:bg-surface-container-low"
          }`}
          style={{ paddingLeft: `${folder.depth * 14}px` }}
        >
          {children.length > 0 ? (
            <button
              type="button"
              onClick={() => toggle(folder.id)}
              aria-expanded={isOpen}
              aria-label={`${isOpen ? "Close" : "Open"} ${folder.name}`}
              className="shrink-0 rounded p-1 text-outline transition-colors hover:text-primary"
            >
              {isOpen ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
            </button>
          ) : (
            <span className="w-[21px] shrink-0" aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={() => onSelect(folder.id)}
            aria-current={isSelected ? "true" : undefined}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {isSelected ? <FolderOpen size={14} className="shrink-0" aria-hidden="true" /> : <Folder size={14} className="shrink-0 text-outline" aria-hidden="true" />}
            <span className="min-w-0 truncate">{folder.name}</span>
            {/* What is in it altogether, so a closed row still says its size */}
            {folder.totalItemCount > 0 && (
              <span className={`shrink-0 text-[11px] font-normal ${isSelected ? "text-on-primary-container/80" : "text-outline"}`}>
                {folder.totalItemCount}
              </span>
            )}
            {busyId === folder.id && <Loader2 size={12} className="shrink-0 animate-spin" aria-hidden="true" />}
          </button>
          {/* The row's own three actions, out of the way until the row is pointed at or focused */}
          <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            {canNest && (
              <button
                type="button"
                onClick={() => onCreate(folder.id)}
                title={PROJECT_FOLDER_MESSAGES.newSubfolder}
                aria-label={`${PROJECT_FOLDER_MESSAGES.newSubfolder}: ${folder.name}`}
                className="rounded p-1 text-outline transition-colors hover:text-primary"
              >
                <FolderPlus size={13} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onRename(folder)}
              title={PROJECT_FOLDER_MESSAGES.rename}
              aria-label={`Rename ${folder.name}`}
              className="rounded p-1 text-outline transition-colors hover:text-primary"
            >
              <Pencil size={13} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(folder)}
              title="Delete this folder"
              aria-label={`Delete the folder ${folder.name}`}
              className="rounded p-1 text-outline transition-colors hover:text-error"
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </span>
        </div>
        {isOpen && children.length > 0 && <ul className="flex flex-col">{children.map(rowFor)}</ul>}
      </li>
    )
  }

  const top = childrenOf.get("root") ?? []

  return (
    <nav aria-label="Folders" className="flex min-w-0 flex-col gap-1">
      <div
        className={`flex items-center gap-1 rounded-lg pr-1 transition-colors ${
          selectedId === null ? "bg-primary-container text-on-primary-container" : "hover:bg-surface-container-low"
        }`}
      >
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-current={selectedId === null ? "true" : undefined}
          className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-[13px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {selectedId === null ? <FolderOpen size={14} className="shrink-0" aria-hidden="true" /> : <Folder size={14} className="shrink-0 text-outline" aria-hidden="true" />}
          <span className="min-w-0 truncate">{PROJECT_FOLDER_MESSAGES.root}</span>
          {rootCount > 0 && (
            <span className={`shrink-0 text-[11px] font-normal ${selectedId === null ? "text-on-primary-container/80" : "text-outline"}`}>{rootCount}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => onCreate(null)}
          title={PROJECT_FOLDER_MESSAGES.newFolder}
          aria-label={PROJECT_FOLDER_MESSAGES.newFolder}
          className="rounded p-1 text-outline transition-colors hover:text-primary"
        >
          <FolderPlus size={13} aria-hidden="true" />
        </button>
      </div>
      {top.length > 0 && <ul className="flex flex-col">{top.map(rowFor)}</ul>}
    </nav>
  )
}

// The tree's own rules live in lib/projectFolders.ts, where they are tested on their own; they are
// re-exported here because every page that draws the tree also needs them.
export { folderBranch, folderPath }
