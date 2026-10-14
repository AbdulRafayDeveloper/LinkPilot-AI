"use client"

import React, { useMemo, useState } from "react"
import { useDroppable } from "@dnd-kit/core"
import { ChevronDown, ChevronRight, Folder, FolderInput, FolderOpen, FolderPlus, HardDrive, Loader2, Pencil, Trash2 } from "lucide-react"
import { folderDropId, UNFILED_DROP } from "@/lib/folderDrop"
import type { FolderNode } from "@/lib/folderTree"

/**
 * A nested folder tree: the top of it, then every folder under it, each with how much is filed in it
 * and in the folders inside it.
 *
 * Two modules draw one — a client project's documents and links, and Personal Drive — so the tree is
 * written once and each passes its own words, its own depth and its own way of counting. It is not
 * the shared **flat** folder UI (`FoldersDialog`, the folder filter): those are one list each.
 *
 * Two things are its own rather than the flat pieces': a row opens and closes, and New folder sits
 * on every row, because a folder inside a folder is the point of it. Everything else reads like the
 * rest of the app: one row is selected, the selected row is a filled tile, the counts are grey.
 *
 * **Nothing is hidden by a closed row.** A closed folder still says how much is inside it
 * altogether, so a count never disagrees with what opening it shows.
 *
 * With `isDroppable` every row is a place to drop what is being dragged (`@dnd-kit`), which is what
 * makes filing a file feel like a drive. The page holds the `DndContext` and tells the tree which
 * row the pointer is over; without it the tree is exactly what it always was.
 */

export interface FolderTreeCopy {
  root: string
  newFolder: string
  newSubfolder: string
  rename: string
  move: string
}

interface FolderTreeProps<T extends FolderNode> {
  folders: T[]
  // Which folder is open; null is the top of the tree, where the records in no folder are
  selectedId: string | null
  // How much sits at the top, so the top row says its own count like every folder
  rootCount: number
  // What is in a folder and everything inside it, counted by the module that owns the records
  totalOf: (folder: T) => number
  copy: FolderTreeCopy
  maxDepth: number
  busyId?: string | null
  // The drive drags files onto folders; a project files its documents from the Move dialog alone
  isDroppable?: boolean
  overId?: string | null
  // What this tree is called among the places to drop on, since the same folder is also a tile and a
  // step in the line saying where you are (lib/folderDrop.ts)
  dropPlace?: string
  // The top of the tree is a drive's own place ("My Drive"), with its own icon
  rootIcon?: "folder" | "drive"
  onSelect: (folderId: string | null) => void
  onCreate: (parentId: string | null) => void
  onRename: (folder: T) => void
  onDelete: (folder: T) => void
  // Moving a folder under another one. Without it the row simply has no Move, which is how a client
  // project's tree reads: there a folder is moved from the Move dialog on the list instead
  onMove?: (folder: T) => void
}

/** A row that can be dropped on, which is one hook, so it is its own component. */
const DropRow: React.FC<{ dropId: string; isActive: boolean; children: React.ReactNode }> = ({ dropId, isActive, children }) => {
  const { setNodeRef } = useDroppable({ id: dropId })
  return (
    // The attribute is how a check can see the places a file may be dropped, which nothing else says
    <div ref={setNodeRef} data-folder-drop={dropId} className={isActive ? "rounded-lg ring-2 ring-primary" : undefined}>
      {children}
    </div>
  )
}

export function FolderTree<T extends FolderNode>({
  folders,
  selectedId,
  rootCount,
  totalOf,
  copy,
  maxDepth,
  busyId,
  isDroppable = false,
  overId = null,
  dropPlace = "tree",
  rootIcon = "folder",
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onMove,
}: FolderTreeProps<T>) {
  // Which rows are closed. A folder on the way to the selected one is open whatever is remembered
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())

  const childrenOf = useMemo(() => {
    const map = new Map<string, T[]>()
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

  const wrap = (dropId: string, row: React.ReactNode) => {
    const id = folderDropId(dropId, dropPlace)
    return isDroppable ? (
      <DropRow dropId={id} isActive={overId === id}>
        {row}
      </DropRow>
    ) : (
      row
    )
  }

  const rowFor = (folder: T): React.ReactNode => {
    const children = childrenOf.get(folder.id) ?? []
    const isOpen = !closed.has(folder.id) || openPath.has(folder.id)
    const isSelected = folder.id === selectedId
    const canNest = folder.depth + 1 < maxDepth
    const total = totalOf(folder)
    return (
      <li key={folder.id}>
        {wrap(
          folder.id,
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
              {isSelected ? (
                <FolderOpen size={14} className="shrink-0" aria-hidden="true" />
              ) : (
                <Folder size={14} className="shrink-0 text-outline" aria-hidden="true" />
              )}
              <span className="min-w-0 truncate">{folder.name}</span>
              {/* What is in it altogether, so a closed row still says its size */}
              {total > 0 && (
                <span className={`shrink-0 text-[11px] font-normal ${isSelected ? "text-on-primary-container/80" : "text-outline"}`}>
                  {total}
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
                  title={copy.newSubfolder}
                  aria-label={`${copy.newSubfolder}: ${folder.name}`}
                  className="rounded p-1 text-outline transition-colors hover:text-primary"
                >
                  <FolderPlus size={13} aria-hidden="true" />
                </button>
              )}
              {onMove && (
                <button
                  type="button"
                  onClick={() => onMove(folder)}
                  title={`${copy.move} ${folder.name}`}
                  aria-label={`Move the folder ${folder.name}`}
                  className="rounded p-1 text-outline transition-colors hover:text-primary"
                >
                  <FolderInput size={13} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onRename(folder)}
                title={copy.rename}
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
        )}
        {isOpen && children.length > 0 && <ul className="flex flex-col">{children.map(rowFor)}</ul>}
      </li>
    )
  }

  const top = childrenOf.get("root") ?? []
  const RootIcon = rootIcon === "drive" ? HardDrive : selectedId === null ? FolderOpen : Folder

  return (
    <nav aria-label="Folders" className="flex min-w-0 flex-col gap-1">
      {wrap(
        UNFILED_DROP,
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
            <RootIcon size={14} className={`shrink-0 ${selectedId === null ? "" : "text-outline"}`} aria-hidden="true" />
            <span className="min-w-0 truncate">{copy.root}</span>
            {rootCount > 0 && (
              <span className={`shrink-0 text-[11px] font-normal ${selectedId === null ? "text-on-primary-container/80" : "text-outline"}`}>
                {rootCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onCreate(null)}
            title={copy.newFolder}
            aria-label={copy.newFolder}
            className="rounded p-1 text-outline transition-colors hover:text-primary"
          >
            <FolderPlus size={13} aria-hidden="true" />
          </button>
        </div>
      )}
      {top.length > 0 && <ul className="flex flex-col">{top.map(rowFor)}</ul>}
    </nav>
  )
}
