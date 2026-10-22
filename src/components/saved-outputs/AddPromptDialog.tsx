"use client"

import React, { useRef, useState } from "react"
import { AlertTriangle, Loader2, Save } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { RadioCardGroup } from "@/components/ui/RadioCardGroup"
import { DependencyPicker, pickedSummary } from "./DependencyPicker"
import { togglePicked } from "@/lib/promptDependencies"
import {
  CREATED_NAME_MAX_LENGTH,
  CREATED_PROMPT_MAX_LENGTH,
  DEFAULT_PROMPT_TARGET,
  PROMPT_CREATOR_MESSAGES,
  PROMPT_TARGETS,
  type PromptTargetId,
} from "@/constants/promptCreator"
import { UNFILED_FOLDER_LABEL } from "@/constants/folders"
import { PROMPT_DEPENDENCY_MESSAGES } from "@/constants/promptDependencies"
import { requestApi } from "@/lib/apiClient"
import type { CreatedPrompt } from "@/types/promptCreator"
import type { PromptFolder } from "@/types/promptFolders"

interface AddPromptDialogProps {
  // Where a prompt is saved (POST) and where the prompts it may wait for are listed (GET)
  endpoint: string
  folders: PromptFolder[] | null
  // The folder the list is filtered to, which is the one a prompt added from there starts in
  folderId: string | null
  onAdded: (prompt: CreatedPrompt) => void
  onClose: () => void
}

const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[14px] text-on-surface focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25"
const labelClass = "text-[13px] font-semibold text-on-surface"

/**
 * Adds a prompt the user **already had**, written somewhere else, rather than one this tool writes.
 *
 * It asks for everything a saved prompt carries that the user chooses: the name to find it by, the
 * prompt itself, what it is for, the folder it goes in and the prompts it waits for. Nothing else is
 * asked, because nothing else about a prompt is theirs to set: it was described nowhere, so it has
 * no description, and no model wrote it, so it has no provider. Once saved it is an ordinary record,
 * so it is edited, filed, moved, marked as applied and deleted exactly like a written one.
 */
export const AddPromptDialog: React.FC<AddPromptDialogProps> = ({ endpoint, folders, folderId, onAdded, onClose }) => {
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState("")
  const [prompt, setPrompt] = useState("")
  const [target, setTarget] = useState<PromptTargetId>(DEFAULT_PROMPT_TARGET)
  // A real folder the page is filtered to, never one of the two filter words ("in-folder", "none")
  const [folder, setFolder] = useState<string | null>(folders?.some((entry) => entry.id === folderId) ? folderId : null)
  const [waitsFor, setWaitsFor] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isSaveable = Boolean(name.trim() && prompt.trim())

  const save = async () => {
    if (!isSaveable) {
      setError(name.trim() ? PROMPT_CREATOR_MESSAGES.emptyPrompt : PROMPT_CREATOR_MESSAGES.missingName)
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const { data } = await requestApi<CreatedPrompt>(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), prompt: prompt.trim(), target, folderId: folder, dependencyIds: waitsFor }),
        },
        { idempotent: true }
      )
      onAdded(data)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : PROMPT_CREATOR_MESSAGES.addFailed)
      setIsSaving(false)
    }
  }

  return (
    <Modal
      title={PROMPT_CREATOR_MESSAGES.addTitle}
      onClose={onClose}
      size="large"
      isCloseDisabled={isSaving}
      initialFocusRef={nameRef}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-outline">
            {prompt.length.toLocaleString()} / {CREATED_PROMPT_MAX_LENGTH.toLocaleString()} characters · {pickedSummary(waitsFor)}
          </p>
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
              disabled={isSaving || !isSaveable}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
              {isSaving ? PROMPT_CREATOR_MESSAGES.addSaving : PROMPT_CREATOR_MESSAGES.addSave}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <p className="shrink-0 text-[12px] leading-relaxed text-on-surface-variant">{PROMPT_CREATOR_MESSAGES.addHint}</p>

        {error && (
          <p role="alert" className="flex shrink-0 items-start gap-2 rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        {/* The prompt itself takes the wider side; its choices sit beside it on a wide screen */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="flex min-h-0 flex-col gap-4">
            <label className="flex shrink-0 flex-col gap-1.5">
              <span className={labelClass}>{PROMPT_CREATOR_MESSAGES.addedName}</span>
              <input
                ref={nameRef}
                name="name"
                value={name}
                maxLength={CREATED_NAME_MAX_LENGTH}
                onChange={(event) => setName(event.target.value)}
                disabled={isSaving}
                placeholder="e.g. Write the migration script"
                className={`${fieldClass} h-10 disabled:opacity-60`}
                required
              />
            </label>

            <label className="flex min-h-0 flex-1 flex-col gap-1.5">
              <span className={labelClass}>{PROMPT_CREATOR_MESSAGES.addedPrompt}</span>
              <textarea
                name="prompt"
                value={prompt}
                maxLength={CREATED_PROMPT_MAX_LENGTH}
                onChange={(event) => setPrompt(event.target.value)}
                disabled={isSaving}
                placeholder="Paste the prompt here, exactly as you use it."
                className={`${fieldClass} custom-scrollbar min-h-[180px] flex-1 resize-none py-2.5 font-mono text-[13px] leading-relaxed disabled:opacity-60`}
                required
              />
            </label>
          </div>

          <div className="custom-scrollbar flex min-h-0 flex-col gap-4 overflow-y-auto lg:pl-1">
            <RadioCardGroup
              name="added-prompt-target"
              legend="This prompt is for"
              options={PROMPT_TARGETS}
              value={target}
              onChange={setTarget}
              disabled={isSaving}
              columnsClassName="grid-cols-1"
              wrapLabels
            />

            <label className="flex shrink-0 flex-col gap-1.5">
              <span className={labelClass}>
                Folder <span className="font-normal text-outline">(optional)</span>
              </span>
              <select
                name="folder"
                value={folder ?? ""}
                onChange={(event) => setFolder(event.target.value || null)}
                disabled={isSaving || folders === null}
                className={`${fieldClass} h-10 disabled:opacity-60`}
              >
                <option value="">{folders === null ? "Loading folders..." : UNFILED_FOLDER_LABEL}</option>
                {(folders ?? []).map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex min-h-0 flex-col gap-1.5">
              <span className={labelClass}>
                {PROMPT_DEPENDENCY_MESSAGES.filterLabel} <span className="font-normal text-outline">(optional)</span>
              </span>
              <p className="text-[12px] text-on-surface-variant">{PROMPT_DEPENDENCY_MESSAGES.dialogHint}</p>
              <DependencyPicker
                endpoint={endpoint}
                folders={folders}
                folderId={folder}
                picked={waitsFor}
                onToggle={(id) => setWaitsFor((current) => togglePicked(current, id))}
                disabled={isSaving}
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
