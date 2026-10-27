"use client"

import React, { useMemo, useRef, useState } from "react"
import { AlertCircle, Folder, FolderOpen, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { matchesWords } from "@/lib/nameSearch"
import { folderBranch, folderPath, type FolderNode } from "@/lib/folderTree"

/**
 * The two dialogs a nested folder tree needs: naming a folder, and choosing where something goes.
 *
 * They are shared by the two modules that keep nested folders (a client project's documents and
 * links, and Personal Drive), each passing its own words and its own name length, the way the flat
 * folder dialogs take a `copy` (`constants/folders.ts`).
 */

const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[14px] text-on-surface placeholder:text-outline focus:border-primary focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
const labelClass = "text-[13px] font-semibold text-on-surface"

export interface FolderDialogCopy {
  root: string
  newFolder: string
  moveHere: string
}

export const FolderProblemLine: React.FC<{ error: string | null }> = ({ error }) =>
  error ? (
    <p role="alert" className="flex gap-2 rounded-xl bg-error-container px-3 py-2.5 text-[13px] text-error">
      <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      {error}
    </p>
  ) : null

/**
 * Naming a folder: the one dialog for making one and for renaming one, the way every other pair of
 * Add and Edit in the app shares a dialog. When it is making one inside another, the line above
 * says where it will sit, so a folder is never made somewhere the user did not mean.
 */
export function FolderNameDialog<T extends FolderNode>({
  folders,
  renaming,
  parentId,
  isSaving,
  error,
  copy,
  maxLength,
  onSubmit,
  onClose,
}: {
  folders: T[]
  // The folder being renamed, or the folder a new one goes inside (null for the top)
  renaming: T | null
  parentId: string | null
  isSaving: boolean
  error: string | null
  copy: FolderDialogCopy
  maxLength: number
  onSubmit: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(renaming?.name ?? "")
  const input = useRef<HTMLInputElement>(null)
  const where = folderPath(folders, renaming ? renaming.parentId : parentId)
    .map((folder) => folder.name)
    .join(" / ")

  return (
    <Modal
      title={renaming ? `Rename ${renaming.name}` : copy.newFolder}
      description={where ? `In ${where}.` : `At the top of the list (${copy.root}).`}
      onClose={onClose}
      isCloseDisabled={isSaving}
      initialFocusRef={input}
      size="compact"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="folder-name-form"
            disabled={isSaving || !name.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            {isSaving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            {renaming ? "Save" : "Make folder"}
          </button>
        </div>
      }
    >
      <form
        id="folder-name-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!isSaving && name.trim()) onSubmit(name)
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Folder name</span>
          <input
            ref={input}
            value={name}
            maxLength={maxLength}
            onChange={(event) => setName(event.target.value)}
            className={`${fieldClass} h-10`}
            placeholder="e.g. Invoices"
            disabled={isSaving}
            required
          />
        </label>
        <FolderProblemLine error={error} />
      </form>
    </Modal>
  )
}

/**
 * Where to put something: the whole tree as a list, with the top of it first, searched by typing
 * when the tree is long. It moves a record and it moves a folder, which is why it takes what is
 * being moved rather than only a record: a folder may not be moved inside itself or anything inside
 * it, so that branch is left out of the list rather than offered and then refused.
 */
export function MoveToFolderDialog<T extends FolderNode>({
  folders,
  what,
  movingFolderId,
  currentFolderId,
  isSaving,
  error,
  copy,
  onSubmit,
  onClose,
}: {
  folders: T[]
  // What is being moved, for the title and so a folder is never offered its own branch
  what: string
  movingFolderId?: string | null
  currentFolderId: string | null
  isSaving: boolean
  error: string | null
  copy: FolderDialogCopy
  onSubmit: (folderId: string | null) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState("")
  const [chosen, setChosen] = useState<string | null>(currentFolderId)
  const input = useRef<HTMLInputElement>(null)

  const offered = useMemo(() => {
    const ownBranch = movingFolderId ? folderBranch(folders, movingFolderId) : new Set<string | null>()
    return folders.filter((folder) => !ownBranch.has(folder.id) && (!search.trim() || matchesWords(folder.name, search)))
  }, [folders, movingFolderId, search])

  const rowClass = (isChosen: boolean) =>
    `flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition-colors ${
      isChosen ? "bg-primary-container text-on-primary-container" : "text-on-surface hover:bg-surface-container-low"
    }`

  return (
    <Modal
      title={`Move ${what}`}
      description="Choose where it goes. Nothing inside it changes."
      onClose={onClose}
      isCloseDisabled={isSaving}
      initialFocusRef={input}
      size="compact"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p role="alert" className="min-h-[20px] text-xs text-error">
            {error}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSubmit(chosen)}
              disabled={isSaving || chosen === currentFolderId}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              {copy.moveHere}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <input
          ref={input}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search the folders"
          className={`${fieldClass} h-10`}
          disabled={isSaving}
        />
        <ul className="custom-scrollbar flex max-h-72 flex-col gap-1 overflow-y-auto">
          <li>
            <button type="button" onClick={() => setChosen(null)} className={rowClass(chosen === null)}>
              <FolderOpen size={14} className="shrink-0" aria-hidden="true" />
              {copy.root}
            </button>
          </li>
          {offered.map((folder) => (
            <li key={folder.id}>
              <button
                type="button"
                onClick={() => setChosen(folder.id)}
                className={rowClass(chosen === folder.id)}
                style={{ paddingLeft: `${12 + folder.depth * 14}px` }}
              >
                <Folder size={14} className="shrink-0 text-outline" aria-hidden="true" />
                <span className="min-w-0 truncate">{folder.name}</span>
              </button>
            </li>
          ))}
          {offered.length === 0 && search.trim() && (
            <li className="px-3 py-2 text-[13px] text-outline">No folder matches that search.</li>
          )}
        </ul>
      </div>
    </Modal>
  )
}
