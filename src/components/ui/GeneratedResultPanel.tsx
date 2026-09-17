"use client"

import React from "react"
import { Info, type LucideIcon } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { ResultCard } from "@/components/ui/ResultCard"
import { EditableOutput } from "@/components/ui/EditableOutput"
import { useEditableText } from "@/lib/outputEdits"
import type { GenerationStatus } from "@/hooks/useGenerationRequest"
import { AiSourceLabel } from "@/components/ui/AiSourceLabel"

interface GeneratedResultPanelProps {
  title: string
  status: GenerationStatus
  text: string | null
  // Which tool the text belongs to, so the user's edits are kept per tool (lib/outputEdits.ts)
  editScope: string
  // What the text is, for screen readers ("First message")
  textLabel: string
  error: string | null
  onRetry: () => void
  idleIcon: LucideIcon
  idleText: string
  loadingText: string
  copyLabel: string
  copyButtonText: string
  // Shown after the character count, e.g. the tone
  meta?: React.ReactNode
  // Which AI provider wrote the text, shown last on the same line ("Source: Groq")
  source?: { provider?: string | null; providers?: readonly string[] } | null
  warning?: string | null
  children?: React.ReactNode
}

/**
 * Output card for single-text generators: the result, editable in place with bold (EditableOutput),
 * a prominent copy action for the edited text, the character count, an optional meta line, warning
 * and extra details. Long results scroll inside the card.
 */
export const GeneratedResultPanel: React.FC<GeneratedResultPanelProps> = ({
  title,
  status,
  text,
  editScope,
  textLabel,
  error,
  onRetry,
  idleIcon,
  idleText,
  loadingText,
  copyLabel,
  copyButtonText,
  meta,
  source,
  warning,
  children,
}) => {
  const editable = useEditableText(editScope, text ?? "")

  return (
    <ResultCard
      title={title}
      status={text === null && status === "success" ? "idle" : status}
      error={error}
      onRetry={onRetry}
      idleIcon={idleIcon}
      idleText={idleText}
      loadingText={loadingText}
      headerAction={text !== null && <CopyButton text={editable.value} label={copyLabel} variant="prominent" buttonText={copyButtonText} />}
    >
      <EditableOutput text={editable} label={textLabel} />
      <p className="text-[11px] text-outline">
        {editable.value.length.toLocaleString()} characters
        {meta && <> · {meta}</>}
        <AiSourceLabel source={source} />
      </p>
      {warning && !editable.isEdited && <ResultWarning text={warning} />}
      {children}
    </ResultCard>
  )
}

export const ResultWarning: React.FC<{ text: string }> = ({ text }) => (
  <p className="flex items-start gap-2 bg-secondary-fixed/40 border border-secondary-fixed-dim text-on-secondary-fixed-variant rounded-xl px-3 py-2 text-[12px]">
    <Info size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
    {text}
  </p>
)
