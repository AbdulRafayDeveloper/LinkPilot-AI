"use client"

import React from "react"
import { RotateCcw } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { PROMPT_MAX_LENGTH } from "@/constants/prompts"
import type { EditablePrompt } from "@/types/prompts"

interface PromptEditorFieldProps {
  value: string
  onChange: (value: string) => void
  saved: EditablePrompt
  label: string
  disabled?: boolean
  hint?: React.ReactNode
  textareaRef?: React.Ref<HTMLTextAreaElement>
  // Editor height classes; modals with extra selector rows pass a shorter height so they fit the viewport
  heightClassName?: string
}

function describeSavedState(saved: EditablePrompt): string {
  return saved.isCustom && saved.updatedAt
    ? `Custom prompt · saved ${new Date(saved.updatedAt).toLocaleString()}`
    : "Default prompt"
}

/**
 * Full-height prompt editor with saved-state info, restore-default, copy and a length
 * counter. The textarea scrolls internally so long prompts never stretch the page.
 */
export const PromptEditorField: React.FC<PromptEditorFieldProps> = ({
  value,
  onChange,
  saved,
  label,
  disabled = false,
  hint,
  textareaRef,
  heightClassName = "h-[46vh] min-h-[220px]",
}) => {
  const isDirty = value !== saved.prompt
  const isDefaultValue = value.trim() === saved.defaultPrompt

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-outline">
          {describeSavedState(saved)}
          {isDirty && <span className="text-secondary"> · Unsaved changes</span>}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(saved.defaultPrompt)}
            disabled={isDefaultValue || disabled}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-outline hover:text-primary hover:bg-surface-container transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-outline"
          >
            <RotateCcw size={13} aria-hidden="true" />
            Restore default
          </button>
          <CopyButton text={value} label="Copy prompt" showLabel />
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={PROMPT_MAX_LENGTH}
        spellCheck={false}
        aria-label={label}
        className={`w-full ${heightClassName} resize-y rounded-xl border border-outline-variant bg-surface-container-lowest p-3 font-code text-[13px] leading-relaxed text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary`}
      />

      <div className="flex flex-wrap items-start justify-between gap-2 text-[11px] text-outline">
        <div className="min-w-0 flex-1">{hint}</div>
        <p className="shrink-0">
          {value.length.toLocaleString()} / {PROMPT_MAX_LENGTH.toLocaleString()}
        </p>
      </div>
    </div>
  )
}
