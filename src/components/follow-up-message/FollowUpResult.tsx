"use client"

import React from "react"
import { AlertTriangle, Loader2, RefreshCw, Repeat } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { getFollowUpTypeLabel } from "@/constants/followUp"
import type { GenerationStatus } from "@/hooks/useGenerationRequest"
import type { GeneratedFollowUp } from "@/types/followUp"

interface FollowUpResultProps {
  status: GenerationStatus
  result: GeneratedFollowUp | null
  error: string | null
  onRetry: () => void
}

const centeredState = "flex-1 flex flex-col items-center justify-center text-center gap-3 px-4 py-8"

export const FollowUpResult: React.FC<FollowUpResultProps> = ({ status, result, error, onRetry }) => (
  <section
    aria-labelledby="follow-up-result-title"
    className="bg-white border border-outline-variant rounded-2xl shadow-sm p-5 flex flex-col gap-3 min-h-[240px] lg:min-h-0"
  >
    <div className="flex items-center justify-between gap-2 min-h-[26px]">
      <h2 id="follow-up-result-title" className="text-sm font-bold text-on-surface">
        Generated Follow-Up
      </h2>
      {status === "success" && result && <CopyButton text={result.message} label="Copy follow-up message" showLabel />}
    </div>

    {status === "idle" && (
      <div className={centeredState}>
        <div className="w-11 h-11 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
          <Repeat size={20} aria-hidden="true" />
        </div>
        <p className="text-sm text-on-surface-variant max-w-xs leading-relaxed">
          Paste your previous conversation, choose a follow-up type, and generate a natural next message.
        </p>
      </div>
    )}

    {status === "loading" && (
      <div role="status" className={centeredState}>
        <Loader2 size={22} className="animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold text-on-surface">Reading the conversation and writing your follow-up...</p>
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

    {status === "success" && result && (
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        <blockquote className="min-h-0 overflow-y-auto text-[15px] leading-relaxed text-on-surface whitespace-pre-wrap break-words border-l-2 border-primary bg-surface-container-lowest rounded-r-xl px-4 py-3">
          {result.message}
        </blockquote>
        <p className="text-[11px] text-outline">
          {result.characterCount.toLocaleString()} characters · {getFollowUpTypeLabel(result.type)}
          {result.usedProfile && " · Personalized with profile"}
        </p>
      </div>
    )}
  </section>
)
