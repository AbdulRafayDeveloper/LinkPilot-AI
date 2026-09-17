"use client"

import React, { useMemo, useRef, useState } from "react"
import { Check, FolderPlus, Loader2, Search } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { FOLDER_NAME_MAX_LENGTH, PROMPT_FOLDER_MESSAGES } from "@/constants/promptFolders"
import type { PromptFolder } from "@/types/promptFolders"

interface MoveToFolderDialogProps {
  // What is being moved, named so the right record is going
  title: string
  folders: PromptFolder[] | null
  currentFolderId: string | null
  onMove: (folder: PromptFolder | null) => Promise<void>
  onCreate: (name: string) => Promise<PromptFolder>
  onClose: () => void
}

const rowClass =
  "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"

/**
 * Files one record in a folder. The list is searched as you type, "No folder" is always there to
 * take it out of one, and a name that matches nothing can be made into a folder and used in the
 * same step, so filing something new never means leaving the page first.
 */
export const MoveToFolderDialog: React.FC<MoveToFolderDialogProps> = ({ title, folders, currentFolderId, onMove, onCreate, onClose }) => {
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const term = query.trim()
  const matches = useMemo(() => (folders ?? []).filter((folder) => folder.name.toLowerCase().includes(term.toLowerCase())), [folders, term])
  const exists = (folders ?? []).some((folder) => folder.name.toLowerCase() === term.toLowerCase())

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key)
    setError(null)
    try {
      await action()
      onClose()
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : PROMPT_FOLDER_MESSAGES.moveFailed)
      setBusy(null)
    }
  }

  const spinner = (key: string) => busy === key && <Loader2 size={14} className="animate-spin text-primary" aria-hidden="true" />

  return (
    <Modal title="Move to a folder" description={title} onClose={onClose} size="compact" isCloseDisabled={busy !== null} initialFocusRef={searchRef}>
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30">
          <Search size={15} className="shrink-0 text-outline" aria-hidden="true" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={FOLDER_NAME_MAX_LENGTH}
            disabled={busy !== null}
            aria-label="Search folders, or type a new folder name"
            placeholder="Search folders, or type a new name"
            className="w-full bg-transparent py-2.5 text-[13px] text-on-surface placeholder:text-outline focus:outline-none"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
            {error}
          </p>
        )}

        <div className="custom-scrollbar flex max-h-[46vh] flex-col gap-0.5 overflow-y-auto">
          {!term && (
            <button
              type="button"
              onClick={() => void run("none", () => onMove(null))}
              disabled={busy !== null || currentFolderId === null}
              className={`${rowClass} ${currentFolderId === null ? "bg-surface-container-high text-on-surface-variant" : "text-on-surface hover:bg-surface-container-low"}`}
            >
              <span>{PROMPT_FOLDER_MESSAGES.unfiled}</span>
              {currentFolderId === null ? <Check size={14} className="text-primary" aria-label="Where it is now" /> : spinner("none")}
            </button>
          )}

          {folders === null ? (
            <p className="flex items-center gap-2 px-3 py-2 text-[13px] text-on-surface-variant">
              <Loader2 size={14} className="animate-spin text-primary" aria-hidden="true" />
              Loading folders...
            </p>
          ) : (
            matches.map((folder) => {
              const isCurrent = folder.id === currentFolderId
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => void run(folder.id, () => onMove(folder))}
                  disabled={busy !== null || isCurrent}
                  className={`${rowClass} ${isCurrent ? "bg-surface-container-high text-on-surface-variant" : "text-on-surface hover:bg-surface-container-low"}`}
                >
                  <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-[11px] text-outline">
                    {folder.promptCount.toLocaleString()}
                    {isCurrent ? <Check size={14} className="text-primary" aria-label="Where it is now" /> : spinner(folder.id)}
                  </span>
                </button>
              )
            })
          )}

          {folders !== null && term && !exists && (
            <button
              type="button"
              onClick={() => void run("new", async () => onMove(await onCreate(term)))}
              disabled={busy !== null}
              className={`${rowClass} font-semibold text-primary hover:bg-primary-fixed/40`}
            >
              <span className="min-w-0 flex-1 truncate">
                <FolderPlus size={14} className="mr-1.5 inline-block align-[-2px]" aria-hidden="true" />
                Create &quot;{term}&quot; and move it here
              </span>
              {spinner("new")}
            </button>
          )}

          {folders !== null && folders.length > 0 && matches.length === 0 && term && exists && (
            <p className="px-3 py-2 text-[13px] text-on-surface-variant">No folder matches that name.</p>
          )}
          {folders !== null && folders.length === 0 && !term && (
            <p className="px-3 py-2 text-[13px] text-on-surface-variant">No folders yet. Type a name above to make the first one.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
