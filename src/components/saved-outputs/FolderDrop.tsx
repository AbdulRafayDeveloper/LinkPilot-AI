"use client"

import React from "react"
import { useDraggable, useDroppable } from "@dnd-kit/core"
import { FileText, Folder, FolderOpen, GripVertical } from "lucide-react"
import { PROMPT_FOLDER_MESSAGES } from "@/constants/promptFolders"
import { UNFILED_DROP, folderDropId, folderFromDropId } from "@/lib/folderDrop"
import type { PromptFolder } from "@/types/promptFolders"

/**
 * Filing records by dragging them onto a folder, on the "view all" page of a tool that has folders.
 * The pieces live here and the page holds the `DndContext` around them, because the rows and the
 * folders have to be inside the same one.
 */

/** The handle one row is dragged by. Nothing else starts a drag, so the row's buttons still work. */
export const RowDragHandle: React.FC<{ id: string; label: string; isPicked: boolean }> = ({ id, label, isPicked }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`Move ${label} to a folder by dragging`}
      title="Drag onto a folder to file it"
      className={`flex h-7 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        isDragging ? "cursor-grabbing text-primary" : isPicked ? "text-primary" : "text-outline hover:bg-surface-container-high hover:text-on-surface"
      }`}
    >
      <GripVertical size={14} aria-hidden="true" />
    </button>
  )
}

/** One folder as a place to drop on, lit up while the pointer is over it. */
const FolderDropTarget: React.FC<{ id: string; name: string; count: number | null; isOver: boolean }> = ({ id, name, count, isOver }) => {
  const { setNodeRef } = useDroppable({ id: folderDropId(id) })
  return (
    <li
      ref={setNodeRef}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
        isOver ? "border-primary bg-primary text-white shadow-sm" : "border-outline-variant bg-white text-on-surface"
      }`}
    >
      {id === UNFILED_DROP ? <FileText size={13} aria-hidden="true" /> : isOver ? <FolderOpen size={13} aria-hidden="true" /> : <Folder size={13} aria-hidden="true" />}
      <span className="max-w-[180px] truncate">{name}</span>
      {count !== null && <span className={isOver ? "text-white/80" : "text-outline"}>{count}</span>}
    </li>
  )
}

interface FolderDropBarProps {
  folders: PromptFolder[] | null
  // The drop target the pointer is over, as `useDndContext` reports it
  overId: string | null
  // How many records are travelling, so the bar can say what a drop will do
  movingCount: number
  noun: { one: string; many: string }
}

/**
 * The folders as places to drop on, shown only while something is being dragged so the page reads
 * the same as it always has the rest of the time.
 */
export const FolderDropBar: React.FC<FolderDropBarProps> = ({ folders, overId, movingCount, noun }) => {
  const over = overId ? folderFromDropId(overId) : undefined
  const what = movingCount === 1 ? `this ${noun.one}` : `these ${movingCount} ${noun.many}`
  return (
    <div className="sticky top-0 z-20 flex flex-col gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3 shadow-sm">
      <p className="text-[12px] font-semibold text-on-surface">
        Drop {what} on a folder to file {movingCount === 1 ? "it" : "them"}.
      </p>
      <ul className="flex flex-wrap items-center gap-1.5">
        <FolderDropTarget id={UNFILED_DROP} name={PROMPT_FOLDER_MESSAGES.unfiled} count={null} isOver={over === null && overId !== null} />
        {(folders ?? []).map((folder) => (
          <FolderDropTarget key={folder.id} id={folder.id} name={folder.name} count={folder.promptCount} isOver={over === folder.id} />
        ))}
      </ul>
    </div>
  )
}

/** What travels under the pointer: the row's own name, or how many are moving together. */
export const DragPreview: React.FC<{ title: string; count: number; noun: { one: string; many: string } }> = ({ title, count, noun }) => (
  <div className="pointer-events-none inline-flex items-center gap-2 rounded-xl border border-primary bg-white px-3 py-2 text-[13px] font-semibold text-on-surface shadow-lg">
    <GripVertical size={14} className="text-primary" aria-hidden="true" />
    <span className="max-w-[240px] truncate">{count > 1 ? `${count} ${noun.many}` : title}</span>
  </div>
)
