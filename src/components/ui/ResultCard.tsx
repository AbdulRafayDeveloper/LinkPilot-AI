"use client"

import React from "react"
import { AlertTriangle, Loader2, RefreshCw, type LucideIcon } from "lucide-react"
import type { GenerationStatus } from "@/hooks/useGenerationRequest"

interface ResultCardProps {
  title: string
  status: GenerationStatus
  error: string | null
  onRetry: () => void
  idleIcon: LucideIcon
  idleText: string
  loadingText: string
  // Shown next to the title once there is a result, e.g. a copy button
  headerAction?: React.ReactNode
  // The success content; rendered only when status is "success"
  children: React.ReactNode
}

const centeredState = "flex-1 flex flex-col items-center justify-center text-center gap-3 px-4 py-8"

/**
 * Output card shell for generators: idle hint, loading, error with retry, and the
 * success content passed as children. The card never grows the page; content scrolls inside.
 */
export const ResultCard: React.FC<ResultCardProps> = ({
  title,
  status,
  error,
  onRetry,
  idleIcon: IdleIcon,
  idleText,
  loadingText,
  headerAction,
  children,
}) => {
  const titleId = React.useId()

  return (
    <section
      aria-labelledby={titleId}
      className="bg-white border border-outline-variant rounded-2xl shadow-sm p-5 flex flex-col gap-3 min-h-[240px] lg:min-h-0"
    >
      <div className="flex items-center justify-between gap-2 min-h-[32px]">
        <h2 id={titleId} className="text-sm font-bold text-on-surface">
          {title}
        </h2>
        {status === "success" && headerAction}
      </div>

      {status === "idle" && (
        <div className={centeredState}>
          <div className="w-11 h-11 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
            <IdleIcon size={20} aria-hidden="true" />
          </div>
          <p className="text-sm text-on-surface-variant max-w-xs leading-relaxed">{idleText}</p>
        </div>
      )}

      {status === "loading" && (
        <div role="status" className={centeredState}>
          <Loader2 size={22} className="animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold text-on-surface">{loadingText}</p>
        </div>
      )}

      {status === "error" && (
        <div role="alert" className={centeredState}>
          <div className="w-11 h-11 rounded-2xl bg-error-container flex items-center justify-center text-error">
            <AlertTriangle size={20} aria-hidden="true" />
          </div>
          <p className="text-sm text-on-surface-variant max-w-xs leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 border border-outline-variant bg-white text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Try again
          </button>
        </div>
      )}

      {status === "success" && <div className="flex-1 min-h-0 flex flex-col gap-2">{children}</div>}
    </section>
  )
}
