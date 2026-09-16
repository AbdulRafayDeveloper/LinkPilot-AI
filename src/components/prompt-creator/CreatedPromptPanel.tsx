"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, Check, Loader2, Pencil } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { requestApi } from "@/lib/apiClient"
import {
  CREATED_NAME_MAX_LENGTH,
  PROMPT_CREATOR_ENDPOINT,
  PROMPT_CREATOR_MESSAGES,
  getPromptTargetLabel,
} from "@/constants/promptCreator"
import type { CreatedPrompt } from "@/types/promptCreator"

// Typing pauses this long before the change is saved
const SAVE_DELAY_MS = 900

type SaveState = "saved" | "saving" | "failed"

interface CreatedPromptPanelProps {
  created: CreatedPrompt
  // Keeps the page's copy in step with what was saved
  onChange: (changes: { name?: string; prompt?: string }) => void
}

/**
 * The finished prompt: its name and text, both edited in place and saved to the same record
 * the module created, plus one copy action for the prompt exactly as it now reads. The page
 * mounts it under the record's id, so a newly created prompt starts this panel fresh.
 */
export const CreatedPromptPanel: React.FC<CreatedPromptPanelProps> = ({ created, onChange }) => {
  const [name, setName] = useState(created.name)
  const [prompt, setPrompt] = useState(created.prompt)
  const [saveState, setSaveState] = useState<SaveState>("saved")
  const [problem, setProblem] = useState<string | null>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The text box grows with the prompt, so it reads like the output rather than a form field
  useEffect(() => {
    const element = promptRef.current
    if (!element) return
    element.style.height = "auto"
    element.style.height = `${element.scrollHeight}px`
  }, [prompt])

  useEffect(() => () => clearTimeout(timerRef.current ?? undefined), [])

  const save = useCallback(
    async (changes: { name?: string; prompt?: string }) => {
      setSaveState("saving")
      try {
        const { data } = await requestApi<CreatedPrompt>(`${PROMPT_CREATOR_ENDPOINT}/created/${created.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        })
        onChange({ name: data.name, prompt: data.prompt })
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
      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-outline">Prompt</span>
          <span className="flex items-center gap-1 text-[11px] text-outline" aria-live="polite">
            {saveState === "saving" && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
            {saveState === "saved" && <Check size={12} className="text-primary" aria-hidden="true" />}
            {saveState === "failed" && <AlertCircle size={12} className="text-error" aria-hidden="true" />}
            {saveState === "saving" ? "Saving..." : saveState === "failed" ? "Not saved" : "Saved to your prompt library"}
          </span>
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
        {problem && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-error/40 bg-error-container px-3 py-2 text-[12px] text-error">
            <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {problem}
          </p>
        )}
      </div>
    </div>
  )
}
