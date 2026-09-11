"use client"

import React from "react"
import { Info, type LucideIcon } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { ResultCard } from "@/components/ui/ResultCard"
import type { GenerationStatus } from "@/hooks/useGenerationRequest"

interface GeneratedResultPanelProps {
  title: string
  status: GenerationStatus
  text: string | null
  error: string | null
  onRetry: () => void
  idleIcon: LucideIcon
  idleText: string
  loadingText: string
  copyLabel: string
  copyButtonText: string
  meta?: React.ReactNode
  warning?: string | null
  children?: React.ReactNode
}

/**
 * Output card for single-text generators: the result with a prominent copy action,
 * plus optional meta line, warning and extra details. Long results scroll inside the card.
 */
export const GeneratedResultPanel: React.FC<GeneratedResultPanelProps> = ({
  title,
  status,
  text,
  error,
  onRetry,
  idleIcon,
  idleText,
  loadingText,
  copyLabel,
  copyButtonText,
  meta,
  warning,
  children,
}) => (
  <ResultCard
    title={title}
    status={text === null && status === "success" ? "idle" : status}
    error={error}
    onRetry={onRetry}
    idleIcon={idleIcon}
    idleText={idleText}
    loadingText={loadingText}
    headerAction={text !== null && <CopyButton text={text} label={copyLabel} variant="prominent" buttonText={copyButtonText} />}
  >
    <blockquote className="min-h-0 overflow-y-auto text-[15px] leading-relaxed text-on-surface whitespace-pre-wrap break-words border-l-2 border-primary bg-surface-container-lowest rounded-r-xl px-4 py-3">
      {text}
    </blockquote>
    {meta && <p className="text-[11px] text-outline">{meta}</p>}
    {warning && <ResultWarning text={warning} />}
    {children}
  </ResultCard>
)

export const ResultWarning: React.FC<{ text: string }> = ({ text }) => (
  <p className="flex items-start gap-2 bg-secondary-fixed/40 border border-secondary-fixed-dim text-on-secondary-fixed-variant rounded-xl px-3 py-2 text-[12px]">
    <Info size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
    {text}
  </p>
)
