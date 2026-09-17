"use client"

import React, { useRef, useState } from "react"
import { Check, FolderPlus, Loader2, Pencil, Trash2, X } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { FOLDER_NAME_MAX_LENGTH, PROMPT_FOLDER_MESSAGES } from "@/constants/promptFolders"
import type { PromptFolder } from "@/types/promptFolders"

interface FoldersDialogProps {
  folders: PromptFolder[] | null
  onCreate: (name: string) => Promise<PromptFolder>
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

const fieldClass =
  "h-9 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[13px] text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
const iconButton =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-outline-variant text-outline transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"

/**
 * Making, renaming and deleting folders in one place. Deleting a folder keeps the records in it and
 * puts them back under "No folder", so a folder is only a label and never holds anything hostage;
 * a delete still asks first, because the folder itself doesn't come back.
 */
export const FoldersDialog: React.FC<FoldersDialogProps> = ({ folders, onCreate, onRename, onDelete, onClose }) => {
  const [newName, setNewName] = useState("")
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const newRef = useRef<HTMLInputElement>(null)

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key)
    setError(null)
    try {
      await action()
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : PROMPT_FOLDER_MESSAGES.createFailed)
    } finally {
      setBusy(null)
    }
  }

  const add = () => {
    const name = newName.trim()
    if (!name || busy) return
    void run("new", async () => {
      await onCreate(name)
      setNewName("")
    })
  }

  return (
    <Modal title="Folders" description="Make, rename and delete the folders your prompts are filed in." onClose={onClose} isCloseDisabled={busy !== null} initialFocusRef={newRef}>
      <div className="flex flex-col gap-4">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            add()
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={newRef}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            maxLength={FOLDER_NAME_MAX_LENGTH}
            disabled={busy !== null}
            aria-label="New folder name"
            placeholder="New folder name"
            className={fieldClass}
          />
          <button
            type="submit"
            disabled={!newName.trim() || busy !== null}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "new" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <FolderPlus size={15} aria-hidden="true" />}
            Add
          </button>
        </form>

        {error && (
          <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
            {error}
          </p>
        )}

        {folders === null ? (
          <p className="flex items-center gap-2 text-[13px] text-on-surface-variant">
            <Loader2 size={14} className="animate-spin text-primary" aria-hidden="true" />
            Loading folders...
          </p>
        ) : folders.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant">No folders yet. The first one can be made above, or straight from a prompt&apos;s Move button.</p>
        ) : (
          <ul className="custom-scrollbar flex max-h-[46vh] flex-col divide-y divide-outline-variant/60 overflow-y-auto rounded-xl border border-outline-variant">
            {folders.map((folder) => (
              <li key={folder.id} className="flex flex-col gap-2 px-3 py-2">
                {editing?.id === folder.id ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      const name = editing.name.trim()
                      if (!name) return
                      void run(folder.id, async () => {
                        await onRename(folder.id, name)
                        setEditing(null)
                      })
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      autoFocus
                      value={editing.name}
                      onChange={(event) => setEditing({ id: folder.id, name: event.target.value })}
                      onKeyDown={(event) => event.key === "Escape" && setEditing(null)}
                      maxLength={FOLDER_NAME_MAX_LENGTH}
                      disabled={busy !== null}
                      aria-label={`Rename ${folder.name}`}
                      className={fieldClass}
                    />
                    <button type="submit" disabled={!editing.name.trim() || busy !== null} aria-label="Save the new name" className={`${iconButton} hover:text-primary`}>
                      {busy === folder.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                    </button>
                    <button type="button" onClick={() => setEditing(null)} disabled={busy !== null} aria-label="Keep the old name" className={iconButton}>
                      <X size={15} aria-hidden="true" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-on-surface">{folder.name}</span>
                    <span className="shrink-0 text-[11px] text-outline">
                      {folder.promptCount.toLocaleString()} {folder.promptCount === 1 ? "prompt" : "prompts"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirming(null)
                        setEditing({ id: folder.id, name: folder.name })
                      }}
                      disabled={busy !== null}
                      aria-label={`Rename ${folder.name}`}
                      className={`${iconButton} hover:text-primary`}
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(confirming === folder.id ? null : folder.id)}
                      disabled={busy !== null}
                      aria-label={`Delete ${folder.name}`}
                      className={`${iconButton} hover:border-error/40 hover:bg-error-container hover:text-error`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}

                {confirming === folder.id && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-error-container/60 px-3 py-2">
                    <p className="text-[12px] text-on-surface">
                      Delete &quot;{folder.name}&quot;? {PROMPT_FOLDER_MESSAGES.deleteExplains}
                    </p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setConfirming(null)} disabled={busy !== null} className="rounded-lg border border-outline-variant bg-white px-3 py-1 text-[12px] font-semibold">
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void run(folder.id, async () => {
                            await onDelete(folder.id)
                            setConfirming(null)
                          })
                        }
                        disabled={busy !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-error px-3 py-1 text-[12px] font-semibold text-white disabled:opacity-60"
                      >
                        {busy === folder.id && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                        Delete folder
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
