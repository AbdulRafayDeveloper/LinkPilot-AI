"use client"

import React from "react"
import { useDroppable } from "@dnd-kit/core"
import { ChevronRight, Folder, FolderOpen } from "lucide-react"
import { folderDropId } from "@/lib/folderDrop"
import type { DriveFolder } from "@/types/importantFiles"

// The same folder is a row on the tree as well, so each place to drop on needs its own name
const TILE = "tile"

/**
 * The folders inside the one being looked at, drawn above its files.
 *
 * The tree on the left is how the whole drive is navigated; these tiles are how it is navigated
 * **where the user is already looking**, which is what a drive does. Each tile is also a place to
 * drop a file on, so filing something one folder down never means opening that folder first.
 *
 * A tile opens a folder and nothing else: making, renaming, moving and deleting folders all live on
 * the tree, so there is one place to look for them rather than two.
 */

const Tile: React.FC<{ folder: DriveFolder; isOver: boolean; onOpen: (folderId: string) => void }> = ({
  folder,
  isOver,
  onOpen,
}) => {
  const { setNodeRef } = useDroppable({ id: folderDropId(folder.id, TILE) })
  return (
    <li ref={setNodeRef}>
      <button
        type="button"
        onClick={() => onOpen(folder.id)}
        aria-label={`Open the folder ${folder.name}`}
        className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
          isOver ? "border-primary bg-primary-container" : "border-outline-variant bg-surface-container-lowest hover:border-primary/40"
        }`}
      >
        {isOver ? (
          <FolderOpen size={16} className="shrink-0 text-primary" aria-hidden="true" />
        ) : (
          <Folder size={16} className="shrink-0 text-primary" aria-hidden="true" />
        )}
        <span className="min-w-0 truncate text-[13px] font-semibold text-on-surface">{folder.name}</span>
        {folder.totalFileCount > 0 && <span className="shrink-0 text-[11px] text-outline">{folder.totalFileCount}</span>}
        <ChevronRight size={14} className="ml-auto shrink-0 text-outline" aria-hidden="true" />
      </button>
    </li>
  )
}

export const DriveFolderTiles: React.FC<{
  folders: DriveFolder[]
  // The folder the pointer is over while something is dragged, as the page's DndContext reports it
  overId: string | null
  onOpen: (folderId: string) => void
}> = ({ folders, overId, onOpen }) => {
  if (folders.length === 0) return null
  return (
    <section className="mb-3 flex flex-col gap-2" aria-label="Folders in here">
      <h2 className="text-[10px] font-bold uppercase tracking-wider text-outline">Folders</h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {folders.map((folder) => (
          <Tile key={folder.id} folder={folder} isOver={overId === folderDropId(folder.id, TILE)} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  )
}
