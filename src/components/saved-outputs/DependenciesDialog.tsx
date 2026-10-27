"use client"

import React, { useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { DependencyPicker, pickedSummary } from "./DependencyPicker"
import { togglePicked } from "@/lib/promptDependencies"
import { PROMPT_DEPENDENCY_MESSAGES } from "@/constants/promptDependencies"
import type { PromptDependency } from "@/types/promptCreator"
import type { PromptFolder } from "@/types/promptFolders"

interface DependenciesDialogProps {
  // The record being changed, named so it is clear which one is going to wait
  title: string
  recordId: string
  // Where the choices are listed and where the change is saved: GET here, PUT here/<id>
  endpoint: string
  waitingFor: PromptDependency[]
  // The account's folders, and the one the record is filed in, which the list starts on
  folders: PromptFolder[] | null
  folderId: string | null
  onSave: (ids: string[]) => Promise<void>
  onClose: () => void
}

/**
 * Changes what one prompt waits for. The list is the shared `DependencyPicker`: the account's own
 * prompts, searched as you type, each saying whether it has run, and whatever the prompt already
 * waits for is shown picked even when the search, the folder or the limit would hide it. The prompt
 * itself is never offered, and a pick that would make a loop is refused by the server with a
 * message saying so.
 *
 * **The list starts on the prompt's own folder**, because a series of prompts is usually filed
 * together and what one waits for is nearly always beside it.
 */
export const DependenciesDialog: React.FC<DependenciesDialogProps> = ({
  title,
  recordId,
  endpoint,
  waitingFor,
  folders,
  folderId,
  onSave,
  onClose,
}) => {
  const [picked, setPicked] = useState<string[]>(waitingFor.map((dependency) => dependency.id))
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const save = async () => {
    setIsSaving(true)
    setError(null)
    try {
      await onSave(picked)
      onClose()
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : PROMPT_DEPENDENCY_MESSAGES.saveFailed)
      setIsSaving(false)
    }
  }

  return (
    <Modal
      title={PROMPT_DEPENDENCY_MESSAGES.dialogTitle}
      description={title}
      onClose={onClose}
      size="compact"
      isCloseDisabled={isSaving}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-outline">{pickedSummary(picked)}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {isSaving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              Save
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[12px] text-on-surface-variant">{PROMPT_DEPENDENCY_MESSAGES.dialogHint}</p>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <DependencyPicker
          endpoint={endpoint}
          excludeId={recordId}
          alreadyPicked={waitingFor.map((dependency) => dependency.id)}
          folders={folders}
          folderId={folderId}
          picked={picked}
          onToggle={(id) => setPicked((current) => togglePicked(current, id))}
          disabled={isSaving}
        />
      </div>
    </Modal>
  )
}
