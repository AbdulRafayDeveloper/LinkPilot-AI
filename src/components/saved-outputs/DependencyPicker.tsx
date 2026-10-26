"use client"

import React, { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Check, CircleCheck, CircleDashed, Loader2, Search } from "lucide-react"
import { SearchableSelectFilter } from "@/components/history/HistoryFilters"
import { requestApi } from "@/lib/apiClient"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { HISTORY_DEBOUNCE_MS } from "@/constants/historyFilters"
import { MAX_DEPENDENCIES, PROMPT_DEPENDENCY_MESSAGES } from "@/constants/promptDependencies"
import { PROMPT_FOLDER_MESSAGES, UNFILED_FOLDER } from "@/constants/promptFolders"
import type { PromptDependency } from "@/types/promptCreator"
import type { PromptFolder } from "@/types/promptFolders"

interface DependencyPickerProps {
  // Where the choices are listed: GET <endpoint>?search=&folder=&exclude=&include=
  endpoint: string
  // The record being changed, which is never offered to itself; nothing for a prompt being added
  excludeId?: string
  // What it already waits for, so those stay listed however the search or the folder narrows things
  alreadyPicked?: readonly string[]
  // The account's folders, and the folder the list starts on
  folders: PromptFolder[] | null
  folderId: string | null
  picked: readonly string[]
  /**
   * One prompt picked or unpicked. It names the prompt rather than handing back a whole new list on
   * purpose: the caller then changes its own state with an updater, so two picks in the same tick
   * can't both be worked out from the list as it was before either of them (the rule Daily Tasks'
   * own picking follows).
   */
  onToggle: (id: string) => void
  disabled?: boolean
}

const rowClass =
  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"

/**
 * The list a prompt's dependencies are picked from: the account's own prompts, newest first and
 * searched as you type, each saying whether it has run (applied), narrowed by a folder.
 *
 * It is its own component because two surfaces pick from the same list: the dialog that changes what
 * a saved prompt waits for, and the form that adds a prompt the user already had. The picking itself
 * is the caller's state, so each one decides what to do with it (save it to a record, or hold it
 * until the new prompt is created).
 */
export const DependencyPicker: React.FC<DependencyPickerProps> = ({
  endpoint,
  excludeId,
  alreadyPicked,
  folders,
  folderId,
  picked,
  onToggle,
  disabled = false,
}) => {
  const [query, setQuery] = useState("")
  const [folder, setFolder] = useState(folderId ?? "")
  const [choices, setChoices] = useState<PromptDependency[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const settled = useDebouncedValue(query.trim(), HISTORY_DEBOUNCE_MS)
  // The ids as one string, so a new array of the same prompts never asks for the list again
  const alreadyWaiting = (alreadyPicked ?? []).join(",")

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams()
    if (excludeId) params.set("exclude", excludeId)
    if (settled) params.set("search", settled)
    if (folder) params.set("folder", folder)
    if (alreadyWaiting) params.set("include", alreadyWaiting)
    requestApi<{ prompts: PromptDependency[] }>(`${endpoint}?${params}`, { signal: controller.signal })
      .then(({ data }) => {
        setChoices(data.prompts)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setChoices([])
        setError(reason instanceof Error ? reason.message : PROMPT_DEPENDENCY_MESSAGES.loadFailed)
      })
    return () => controller.abort()
  }, [endpoint, excludeId, settled, folder, alreadyWaiting])

  // "No folder" first, then every folder with how many prompts it holds, as the history's filter lists them
  const folderOptions = useMemo(
    () => [
      { id: UNFILED_FOLDER, label: PROMPT_FOLDER_MESSAGES.unfiled },
      ...(folders ?? []).map((entry) => ({ id: entry.id, label: `${entry.name} (${entry.recordCount})`, searchText: entry.name })),
    ],
    [folders]
  )

  const isFull = picked.length >= MAX_DEPENDENCIES

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <SearchableSelectFilter
        label={PROMPT_DEPENDENCY_MESSAGES.folderLabel}
        allLabel={PROMPT_FOLDER_MESSAGES.allFolders}
        value={folder}
        options={folderOptions}
        onChange={setFolder}
        searchPlaceholder={PROMPT_FOLDER_MESSAGES.searchFolders}
        emptyLabel={PROMPT_FOLDER_MESSAGES.noFolderMatch}
      />

      <label className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30">
        <Search size={15} className="shrink-0 text-outline" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={disabled}
          aria-label={PROMPT_DEPENDENCY_MESSAGES.searchPrompts}
          placeholder={PROMPT_DEPENDENCY_MESSAGES.searchPrompts}
          className="w-full bg-transparent py-2.5 text-[13px] text-on-surface placeholder:text-outline focus:outline-none"
        />
      </label>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {!choices ? (
        <p role="status" className="flex items-center gap-2 py-6 text-[12px] text-on-surface-variant">
          <Loader2 size={14} className="animate-spin text-primary" aria-hidden="true" />
          Loading your prompts...
        </p>
      ) : choices.length === 0 ? (
        <p className="rounded-xl bg-surface-container-lowest px-3 py-6 text-center text-[12px] text-on-surface-variant">
          {query.trim()
            ? PROMPT_DEPENDENCY_MESSAGES.noPromptMatch
            : folder
              ? PROMPT_DEPENDENCY_MESSAGES.noPromptInFolder
              : PROMPT_DEPENDENCY_MESSAGES.onlyPrompt}
        </p>
      ) : (
        <ul className="custom-scrollbar flex max-h-[46vh] min-h-0 flex-col gap-1 overflow-y-auto pr-1">
          {choices.map((choice) => {
            const isPicked = picked.includes(choice.id)
            return (
              <li key={choice.id}>
                <button
                  type="button"
                  onClick={() => onToggle(choice.id)}
                  disabled={disabled || (isFull && !isPicked)}
                  aria-pressed={isPicked}
                  className={`${rowClass} ${isPicked ? "bg-primary/5 text-on-surface" : "text-on-surface-variant hover:bg-surface-container-high"}`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isPicked ? "border-primary bg-primary text-white" : "border-outline-variant"
                    }`}
                  >
                    {isPicked && <Check size={11} />}
                  </span>
                  <span className="min-w-0 flex-1 break-words font-semibold">{choice.name || "Untitled prompt"}</span>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold ${
                      choice.appliedAt ? "text-on-success-container" : "text-outline"
                    }`}
                  >
                    {choice.appliedAt ? <CircleCheck size={12} aria-hidden="true" /> : <CircleDashed size={12} aria-hidden="true" />}
                    {choice.appliedAt ? "Applied" : "Not yet"}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** How many of the dependencies a prompt may have are picked, for a footer or a hint. */
export const pickedSummary = (picked: readonly string[]): string =>
  picked.length === 0 ? PROMPT_DEPENDENCY_MESSAGES.none : `Waits for ${picked.length} of ${MAX_DEPENDENCIES}`
