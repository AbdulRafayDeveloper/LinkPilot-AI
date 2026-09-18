"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, Check, Cpu, Folder, FolderInput, Hourglass, ListChecks, Loader2, Pencil } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { requestApi } from "@/lib/apiClient"
import {
  CREATED_NAME_MAX_LENGTH,
  PROMPT_CREATOR_ENDPOINT,
  PROMPT_CREATOR_MESSAGES,
  getPromptTargetLabel,
} from "@/constants/promptCreator"
import { describeSource } from "@/constants/aiProviders"
import { PROMPT_CREATOR_RECORD_ENDPOINT, PROMPT_FOLDER_MESSAGES } from "@/constants/promptFolders"
import { PROMPT_DEPENDENCY_MESSAGES } from "@/constants/promptDependencies"
import { usePromptFolders } from "@/hooks/usePromptFolders"
import { MoveToFolderDialog } from "@/components/saved-outputs/MoveToFolderDialog"
import { DependenciesDialog } from "@/components/saved-outputs/DependenciesDialog"
import { PROMPT_FOLDERS_ENDPOINT } from "@/constants/promptFolders"
import type { CreatedPrompt, PromptDependency } from "@/types/promptCreator"
import { AiSourceLabel } from "@/components/ui/AiSourceLabel"

// Typing pauses this long before the change is saved
const SAVE_DELAY_MS = 900

type SaveState = "saved" | "saving" | "failed"

/** What changed on the record, so the page's copy follows what was saved. */
export type CreatedPromptChanges = { name?: string; prompt?: string; folderId?: string | null; dependencies?: PromptDependency[] }

interface CreatedPromptPanelProps {
  created: CreatedPrompt
  // Keeps the page's copy in step with what was saved
  onChange: (changes: CreatedPromptChanges) => void
}

/**
 * The finished prompt: its name and text, both edited in place and saved to the same record the
 * module created, the folder it is filed in, what it waits for, and one copy action for the prompt
 * exactly as it now reads. The page mounts it under the record's id, so a newly created prompt
 * starts this panel fresh.
 *
 * What it waits for is set here as well as from the history, with the same dialog: a prompt written
 * as the next step of a series can be tied to the steps before it the moment it is written, and the
 * dialog starts on the folder it was just filed in.
 *
 * A prompt created with "use once" has no record (`id` is empty): it can be read, changed here and
 * copied, but nothing is saved and it has no folder, so those controls are left out rather than
 * offered and refused.
 */
export const CreatedPromptPanel: React.FC<CreatedPromptPanelProps> = ({ created, onChange }) => {
  const [name, setName] = useState(created.name)
  const [prompt, setPrompt] = useState(created.prompt)
  const [saveState, setSaveState] = useState<SaveState>("saved")
  const [problem, setProblem] = useState<string | null>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isMoving, setIsMoving] = useState(false)
  const [isPickingDependencies, setIsPickingDependencies] = useState(false)
  const waitsFor = created.dependencies ?? []
  // Nothing was stored for a temporary prompt, so there is nothing to save changes to
  const isTemporary = created.id === ""
  const folders = usePromptFolders(isTemporary ? undefined : PROMPT_FOLDERS_ENDPOINT)
  const folderName = folders.folders?.find((folder) => folder.id === created.folderId)?.name ?? null

  // The text box grows with the prompt, so it reads like the output rather than a form field
  useEffect(() => {
    const element = promptRef.current
    if (!element) return
    element.style.height = "auto"
    element.style.height = `${element.scrollHeight}px`
  }, [prompt])

  useEffect(() => () => clearTimeout(timerRef.current ?? undefined), [])

  const save = useCallback(
    async (changes: { name?: string; prompt?: string; folderId?: string | null }) => {
      // A temporary prompt lives on the page only; the change stays on screen and goes nowhere
      if (created.id === "") {
        onChange(changes)
        return
      }
      setSaveState("saving")
      try {
        const { data } = await requestApi<CreatedPrompt>(`${PROMPT_CREATOR_ENDPOINT}/created/${created.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        })
        onChange({ name: data.name, prompt: data.prompt, folderId: data.folderId })
        setSaveState("saved")
        setProblem(null)
      } catch (error: unknown) {
        const message = error instanceof Error && !(error instanceof TypeError) ? error.message : ""
        setProblem(message || PROMPT_CREATOR_MESSAGES.saveFailed)
        setSaveState("failed")
      }
    },
    [created.id, onChange]
  )

  /**
   * Saves what the prompt waits for. It throws on a refusal (a loop, a prompt gone meanwhile) rather
   * than swallowing it, so the dialog it came from shows the server's own reason and stays open.
   */
  const saveDependencies = async (ids: string[]) => {
    const { data } = await requestApi<CreatedPrompt>(`${PROMPT_CREATOR_RECORD_ENDPOINT}/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dependencyIds: ids }),
    })
    onChange({ dependencies: data.dependencies ?? [] })
  }

  const saveLater = (changes: { name?: string; prompt?: string }) => {
    clearTimeout(timerRef.current ?? undefined)
    timerRef.current = setTimeout(() => void save(changes), SAVE_DELAY_MS)
  }

  const changePrompt = (value: string) => {
    setPrompt(value)
    setSaveState("saving")
    if (!value.trim()) {
      setProblem(PROMPT_CREATOR_MESSAGES.emptyPrompt)
      clearTimeout(timerRef.current ?? undefined)
      return
    }
    setProblem(null)
    saveLater({ prompt: value })
  }

  const commitName = () => {
    const cleaned = name.replace(/\s+/g, " ").trim()
    setName(cleaned || created.name)
    if (!cleaned) {
      setProblem(PROMPT_CREATOR_MESSAGES.missingName)
      return
    }
    setProblem(null)
    if (cleaned !== created.name) void save({ name: cleaned })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* The name the module wrote, renamed in place */}
      <div>
        <label htmlFor="created-prompt-name" className="text-[10px] font-bold uppercase tracking-wider text-outline">
          Prompt name
        </label>
        <div className="mt-1 flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
          <Pencil size={14} className="shrink-0 text-outline" aria-hidden="true" />
          <input
            id="created-prompt-name"
            value={name}
            maxLength={CREATED_NAME_MAX_LENGTH}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur()
              if (event.key === "Escape") setName(created.name)
            }}
            aria-label="Prompt name, editable"
            className="w-full bg-transparent text-sm font-semibold text-on-surface focus:outline-none"
          />
          <CopyButton text={name} label="Copy the prompt name" />
        </div>
      </div>

      {/* The prompt itself */}
      {/* Where it is filed, so a new prompt can go straight into a folder */}
      {isTemporary ? (
        <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-secondary-fixed px-2.5 py-1 text-[11px] font-semibold text-on-secondary-fixed-variant">
          <Folder size={12} className="shrink-0" aria-hidden="true" />
          Not saved. Copy it before you leave this page.
        </p>
      ) : (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-secondary-fixed px-2.5 py-1 text-[11px] font-semibold text-on-surface">
          <Folder size={12} className="shrink-0 text-secondary-container" aria-hidden="true" />
          <span className="truncate">{created.folderId ? (folderName ?? "Folder") : PROMPT_FOLDER_MESSAGES.unfiled}</span>
        </span>
        <button
          type="button"
          onClick={() => setIsMoving(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-2.5 py-1 text-[11px] font-semibold text-on-surface transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <FolderInput size={12} aria-hidden="true" />
          {created.folderId ? "Move to another folder" : "Add to a folder"}
        </button>
        {/* What it waits for, set the moment it is written rather than only from the history */}
        <span
          title={waitsFor.map((entry) => `${entry.name || "Untitled prompt"} (${entry.appliedAt ? "applied" : "not yet"})`).join("\n") || undefined}
          className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-surface-container-high px-2.5 py-1 text-[11px] font-semibold text-on-surface"
        >
          <Hourglass size={12} className="shrink-0 text-outline" aria-hidden="true" />
          <span className="truncate">
            {waitsFor.length === 0
              ? PROMPT_DEPENDENCY_MESSAGES.none
              : `${PROMPT_DEPENDENCY_MESSAGES.dependsOn} ${waitsFor.map((entry) => entry.name || "Untitled prompt").join(", ")}`}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setIsPickingDependencies(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-2.5 py-1 text-[11px] font-semibold text-on-surface transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ListChecks size={12} aria-hidden="true" />
          {waitsFor.length === 0 ? PROMPT_DEPENDENCY_MESSAGES.setDependencies : PROMPT_DEPENDENCY_MESSAGES.changeDependencies}
        </button>
      </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-outline">Prompt</span>
          {/* A temporary prompt is never written anywhere, so it has no saving state to report:
              saying "Saved to your prompt library" there would be untrue */}
          {!isTemporary && (
            <span className="flex items-center gap-1 text-[11px] text-outline" aria-live="polite">
              {saveState === "saving" && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
              {saveState === "saved" && <Check size={12} className="text-primary" aria-hidden="true" />}
              {saveState === "failed" && <AlertCircle size={12} className="text-error" aria-hidden="true" />}
              {saveState === "saving" ? "Saving..." : saveState === "failed" ? "Not saved" : "Saved to your prompt library"}
            </span>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-r-xl border-l-2 border-primary bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary/30">
          <textarea
            ref={promptRef}
            value={prompt}
            onChange={(event) => changePrompt(event.target.value)}
            rows={1}
            spellCheck
            aria-label="Created prompt, editable"
            className="block w-full resize-none overflow-hidden break-words bg-transparent px-4 py-3 font-code text-[13px] leading-relaxed text-on-surface focus:outline-none"
          />
        </div>
        <p className="text-[11px] text-outline">
          {prompt.length.toLocaleString()} characters · {getPromptTargetLabel(created.target)} · click the text to edit
        </p>
        {describeSource(created) && (
          <p className="flex items-center gap-1.5 text-[12px] text-on-surface-variant">
            <Cpu size={13} className="shrink-0 text-primary" aria-hidden="true" />
            <AiSourceLabel source={created} prefix="" className="font-semibold text-on-surface" />
          </p>
        )}
        {problem && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-error/40 bg-error-container px-3 py-2 text-[12px] text-error">
            <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {problem}
          </p>
        )}
      </div>
      {isMoving && (
        <MoveToFolderDialog
          title={name}
          folders={folders.folders}
          currentFolderId={created.folderId}
          onMove={async (folder) => {
            await save({ folderId: folder?.id ?? null })
            folders.countMoved(created.folderId, folder?.id ?? null)
          }}
          onCreate={folders.create}
          onClose={() => setIsMoving(false)}
        />
      )}
      {isPickingDependencies && (
        <DependenciesDialog
          title={name}
          recordId={created.id}
          endpoint={PROMPT_CREATOR_RECORD_ENDPOINT}
          waitingFor={waitsFor}
          folders={folders.folders}
          folderId={created.folderId}
          onSave={saveDependencies}
          onClose={() => setIsPickingDependencies(false)}
        />
      )}
    </div>
  )
}
