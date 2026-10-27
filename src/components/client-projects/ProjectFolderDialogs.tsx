"use client"

import React, { useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import {
  FolderNameDialog as SharedFolderNameDialog,
  FolderProblemLine,
  MoveToFolderDialog as SharedMoveToFolderDialog,
} from "@/components/folders/FolderDialogs"
import {
  PROJECT_DOCUMENT_NAME_MAX_LENGTH,
  PROJECT_DOCUMENT_TEXT_MAX_LENGTH,
  PROJECT_FOLDER_MESSAGES,
  PROJECT_FOLDER_NAME_MAX_LENGTH,
} from "@/constants/clientProjectTasks"
import type { ProjectFolder } from "@/types/clientProjectTasks"
import { folderPath } from "@/lib/projectFolders"

const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[14px] text-on-surface placeholder:text-outline focus:border-primary focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
const labelClass = "text-[13px] font-semibold text-on-surface"

const Problem = FolderProblemLine

/**
 * Naming a folder, in this project's own words. The dialog itself is the shared one
 * (`components/folders/FolderDialogs`), which Personal Drive opens too.
 */
export const FolderNameDialog: React.FC<{
  folders: ProjectFolder[]
  // The folder being renamed, or the folder a new one goes inside (null for the top)
  renaming: ProjectFolder | null
  parentId: string | null
  isSaving: boolean
  error: string | null
  onSubmit: (name: string) => void
  onClose: () => void
}> = (props) => (
  <SharedFolderNameDialog {...props} copy={PROJECT_FOLDER_MESSAGES} maxLength={PROJECT_FOLDER_NAME_MAX_LENGTH} />
)

/** Where an item or a folder goes, in this project's own words; the shared picker does the work. */
export const MoveToFolderDialog: React.FC<{
  folders: ProjectFolder[]
  // What is being moved, for the title and so a folder is never offered its own branch
  what: string
  movingFolderId?: string | null
  currentFolderId: string | null
  isSaving: boolean
  error: string | null
  onSubmit: (folderId: string | null) => void
  onClose: () => void
}> = (props) => <SharedMoveToFolderDialog {...props} copy={PROJECT_FOLDER_MESSAGES} />

/**
 * Writing a document in the app: a name and the text, kept as a `.txt` file on the project. It is
 * for the note that belongs with a project's files rather than in a chat, and it saves the step of
 * writing a file somewhere else and uploading it.
 */
export const WriteDocumentDialog: React.FC<{
  folders: ProjectFolder[]
  folderId: string | null
  isSaving: boolean
  error: string | null
  onSubmit: (name: string, text: string) => void
  onClose: () => void
}> = ({ folders, folderId, isSaving, error, onSubmit, onClose }) => {
  const [name, setName] = useState("")
  const [text, setText] = useState("")
  const input = useRef<HTMLInputElement>(null)
  const where = folderPath(folders, folderId)
    .map((folder) => folder.name)
    .join(" / ")

  return (
    <Modal
      title={PROJECT_FOLDER_MESSAGES.write}
      description={`${PROJECT_FOLDER_MESSAGES.writeHint} ${where ? `It goes in ${where}.` : `It goes in ${PROJECT_FOLDER_MESSAGES.root}.`}`}
      onClose={onClose}
      isCloseDisabled={isSaving}
      initialFocusRef={input}
      size="large"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Problem error={error} />
          <div className="flex shrink-0 justify-end gap-2">
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
              form="write-document-form"
              disabled={isSaving || !name.trim() || !text.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              {PROJECT_FOLDER_MESSAGES.write}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="write-document-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!isSaving && name.trim() && text.trim()) onSubmit(name, text)
        }}
        className="flex min-h-0 flex-1 flex-col gap-4"
      >
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>{PROJECT_FOLDER_MESSAGES.writeName}</span>
          <input
            ref={input}
            value={name}
            maxLength={PROJECT_DOCUMENT_NAME_MAX_LENGTH}
            onChange={(event) => setName(event.target.value)}
            className={`${fieldClass} h-10`}
            placeholder="e.g. Handover notes"
            disabled={isSaving}
            required
          />
          <span className="text-[12px] text-outline">It is saved as a .txt file, so .txt is added if you leave it off.</span>
        </label>
        <label className="flex min-h-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center justify-between gap-2">
            <span className={labelClass}>{PROJECT_FOLDER_MESSAGES.writeText}</span>
            <span className="text-[11px] text-outline">{text.length.toLocaleString()}</span>
          </span>
          <textarea
            value={text}
            maxLength={PROJECT_DOCUMENT_TEXT_MAX_LENGTH}
            onChange={(event) => setText(event.target.value)}
            className={`${fieldClass} min-h-[40vh] flex-1 py-3 font-code text-[13px] leading-relaxed`}
            placeholder="Write the document here. It is kept exactly as you type it."
            disabled={isSaving}
            required
          />
        </label>
      </form>
    </Modal>
  )
}
