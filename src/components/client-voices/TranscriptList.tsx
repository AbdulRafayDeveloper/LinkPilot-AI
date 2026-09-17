"use client"

import React from "react"
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import type { VoiceEntry } from "@/types/clientVoices"
import { AiSourceLabel } from "@/components/ui/AiSourceLabel"

interface TranscriptListProps {
  voices: VoiceEntry[]
  isProcessing: boolean
  onRetry: (id: string) => void
}

/**
 * One block per voice, in the order the voices were added, never merged. A voice that failed
 * keeps its place with the reason and a way to try it again, so the batch always shows every
 * voice that went into it rather than only the ones that worked.
 */
export const TranscriptList: React.FC<TranscriptListProps> = ({ voices, isProcessing, onRetry }) => (
  <ul className="flex flex-col gap-3">
    {voices.map((voice) => (
      <li key={voice.id} className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-on-surface">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/5 text-[11px] font-bold text-primary">
              {voice.position}
            </span>
            Voice {voice.position}
          </h3>
          <div className="flex items-center gap-1">
            {voice.status === "done" && <CopyButton text={voice.transcript} label={`Copy the transcript of voice ${voice.position}`} showLabel />}
            {voice.status === "failed" && (
              <button
                type="button"
                onClick={() => onRetry(voice.id)}
                disabled={isProcessing}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-outline transition-colors hover:bg-surface-container hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={13} aria-hidden="true" />
                Try this one again
              </button>
            )}
          </div>
        </div>

        <p className="mt-1 truncate text-[11px] text-outline">{voice.name}</p>

        {voice.status === "done" && (
          <>
            <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-on-surface">{voice.transcript}</p>
            <p className="mt-1 text-[11px] text-outline">
              <AiSourceLabel source={{ provider: voice.transcribedBy ?? null }} prefix="" />
            </p>
          </>
        )}

        {voice.status === "transcribing" && (
          <p className="mt-2 flex items-center gap-2 text-[12px] text-on-surface-variant" role="status">
            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            Writing this one out...
          </p>
        )}

        {voice.status === "queued" && <p className="mt-2 text-[12px] text-outline">Waiting its turn.</p>}
        {voice.status === "ready" && <p className="mt-2 text-[12px] text-outline">Not started yet.</p>}

        {voice.status === "failed" && (
          <p role="alert" className="mt-2 flex items-start gap-2 rounded-xl border border-error/40 bg-error-container px-3 py-2 text-[12px] text-error">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {voice.error ?? "This voice couldn't be written out."}
          </p>
        )}
      </li>
    ))}
  </ul>
)
