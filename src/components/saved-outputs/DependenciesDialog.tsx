"use client"

import React, { useEffect, useState } from "react"
import { AlertTriangle, Check, CircleCheck, CircleDashed, Loader2, Search } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { requestApi } from "@/lib/apiClient"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { HISTORY_DEBOUNCE_MS } from "@/constants/historyFilters"
import { MAX_DEPENDENCIES, PROMPT_DEPENDENCY_MESSAGES } from "@/constants/promptDependencies"
import type { PromptDependency } from "@/types/promptCreator"

interface DependenciesDialogProps {
  // The record being changed, named so it is clear which one is going to wait
  title: string
  recordId: string
  // Where the choices are listed and where the change is saved: GET here, PUT here/<id>
  endpoint: string
  waitingFor: PromptDependency[]
  onSave: (ids: string[]) => Promise<void>
  onClose: () => void
}

const rowClass =
  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"

/**
 * Picks what one prompt waits for. The list is the account's own prompts, newest first and searched
 * as you type, each saying whether it has run (applied), and whatever the prompt already waits for is
 * shown picked even when the search or the limit would hide it. The prompt itself is never offered,
 * and a pick that would make a loop is refused by the server with a message saying so.
 */
export const DependenciesDialog: React.FC<DependenciesDialogProps> = ({ title, recordId, endpoint, waitingFor, onSave, onClose }) => {
  const [query, setQuery] = useState("")
  const [choices, setChoices] = useState<PromptDependency[] | null>(null)
  const [picked, setPicked] = useState<string[]>(waitingFor.map((dependency) => dependency.id))
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const settled = useDebouncedValue(query.trim(), HISTORY_DEBOUNCE_MS)
  // The ids as one string, so a new array of the same prompts never asks for the list again
  const alreadyWaiting = waitingFor.map((dependency) => dependency.id).join(",")

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ exclude: recordId })
    if (settled) params.set("search", settled)
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
  }, [endpoint, recordId, settled, alreadyWaiting])

  const toggle = (id: string) =>
    setPicked((current) => (current.includes(id) ? current.filter((picked) => picked !== id) : [...current, id]))

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

  const isFull = picked.length >= MAX_DEPENDENCIES

  return (
    <Modal
      title={PROMPT_DEPENDENCY_MESSAGES.dialogTitle}
      description={title}
      onClose={onClose}
      size="compact"
      isCloseDisabled={isSaving}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-outline">
            {picked.length === 0 ? PROMPT_DEPENDENCY_MESSAGES.none : `Waits for ${picked.length} of ${MAX_DEPENDENCIES}`}
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
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
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

        <label className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30">
          <Search size={15} className="shrink-0 text-outline" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={isSaving}
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
            {query.trim() ? PROMPT_DEPENDENCY_MESSAGES.noPromptMatch : PROMPT_DEPENDENCY_MESSAGES.onlyPrompt}
          </p>
        ) : (
          <ul className="custom-scrollbar flex max-h-[46vh] flex-col gap-1 overflow-y-auto pr-1">
            {choices.map((choice) => {
              const isPicked = picked.includes(choice.id)
              return (
                <li key={choice.id}>
                  <button
                    type="button"
                    onClick={() => toggle(choice.id)}
                    disabled={isSaving || (isFull && !isPicked)}
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
                    <span className="min-w-0 flex-1 truncate font-semibold">{choice.name || "Untitled prompt"}</span>
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
    </Modal>
  )
}
