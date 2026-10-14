"use client"

import React from "react"
import { useDroppable } from "@dnd-kit/core"
import { ChevronRight, HardDrive } from "lucide-react"
import { folderDropId, UNFILED_DROP } from "@/lib/folderDrop"
import { DRIVE_ROOT_LABEL } from "@/constants/importantFiles"
import type { DriveFolder } from "@/types/importantFiles"

// A folder is on the tree and in a tile too, so this line's own targets carry their own name
const CRUMB = "crumb"

/**
 * Where in the drive the user is: My Drive, then every folder down to the open one.
 *
 * Each step is a way back up **and a place to drop on**, which is how a file is taken out of a
 * folder without opening the folder above it first. It is the spine of a drive, and it is what the
 * page uses instead of the tree on a phone.
 */

const Step: React.FC<{
  dropId: string
  label: string
  isCurrent: boolean
  isOver: boolean
  icon?: React.ReactNode
  onOpen: () => void
}> = ({ dropId, label, isCurrent, isOver, icon, onOpen }) => {
  const { setNodeRef } = useDroppable({ id: folderDropId(dropId, CRUMB) })
  return (
    <li ref={setNodeRef} className="flex min-w-0 items-center">
      <button
        type="button"
        onClick={onOpen}
        aria-current={isCurrent ? "page" : undefined}
        className={`flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
          isOver
            ? "bg-primary text-white"
            : isCurrent
              ? "font-bold text-on-surface"
              : "font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
        }`}
      >
        {icon}
        <span className="min-w-0 truncate">{label}</span>
      </button>
    </li>
  )
}

export const DriveBreadcrumb: React.FC<{
  // The folders from the top of the drive down to the open one, the top first
  path: DriveFolder[]
  overId: string | null
  onOpen: (folderId: string | null) => void
}> = ({ path, overId, onOpen }) => (
  <nav aria-label="Where you are" className="min-w-0">
    <ol className="flex flex-wrap items-center gap-0.5">
      <Step
        dropId={UNFILED_DROP}
        label={DRIVE_ROOT_LABEL}
        isCurrent={path.length === 0}
        isOver={overId === folderDropId(UNFILED_DROP, CRUMB)}
        icon={<HardDrive size={14} className="shrink-0" aria-hidden="true" />}
        onOpen={() => onOpen(null)}
      />
      {path.map((folder, index) => (
        <React.Fragment key={folder.id}>
          <ChevronRight size={13} className="shrink-0 text-outline" aria-hidden="true" />
          <Step
            dropId={folder.id}
            label={folder.name}
            isCurrent={index === path.length - 1}
            isOver={overId === folderDropId(folder.id, CRUMB)}
            onOpen={() => onOpen(folder.id)}
          />
        </React.Fragment>
      ))}
    </ol>
  </nav>
)
