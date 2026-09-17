"use client"

import React from "react"
import { AlertTriangle, Info, Loader2, RefreshCw, UserPlus } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { EditableOutput } from "@/components/ui/EditableOutput"
import { useEditableText } from "@/lib/outputEdits"
import { getToneLabel } from "@/constants/connectionNote"
import type { GenerationStatus } from "@/hooks/useGenerationRequest"
import type { GeneratedConnectionNote } from "@/types/connectionNote"
import { AiSourceLabel } from "@/components/ui/AiSourceLabel"

interface NoteResultProps {
  status: GenerationStatus
  result: GeneratedConnectionNote | null
  error: string | null
  onRetry: () => void
}

const centeredState = "flex-1 flex flex-col items-center justify-center text-center gap-3 px-4 py-8"

export const NoteResult: React.FC<NoteResultProps> = ({ status, result, error, onRetry }) => {
  // The note as the user edits it; copy and the count follow the edits
  const note = useEditableText("connection-note", result?.note ?? "")

  return (
    <section
      aria-labelledby="connection-note-result-title"
      className="bg-white border border-outline-variant rounded-2xl shadow-sm p-5 flex flex-col gap-3 min-h-[240px] lg:min-h-0"
    >
      <div className="flex items-center justify-between gap-2 min-h-[26px]">
        <h2 id="connection-note-result-title" className="text-sm font-bold text-on-surface">
          Generated Connection Note
        </h2>
        {status === "success" && result && <CopyButton text={note.value} label="Copy connection note" showLabel />}
      </div>

      {status === "idle" && (
        <div className={centeredState}>
          <div className="w-11 h-11 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
            <UserPlus size={20} aria-hidden="true" />
          </div>
          <p className="text-sm text-on-surface-variant max-w-xs leading-relaxed">
            Paste a LinkedIn profile, choose your tone, and generate a personalized connection note.
          </p>
        </div>
      )}

      {status === "loading" && (
        <div role="status" className={centeredState}>
          <Loader2 size={22} className="animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold text-on-surface">Writing your connection note...</p>
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
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          <EditableOutput text={note} label="Connection note" />
          <p className="text-[11px] text-outline">
            <span className={note.value.length > result.maxCharacters ? "text-error font-semibold" : ""}>
              {note.value.length} / {result.maxCharacters} characters
            </span>{" "}
            · {getToneLabel(result.tone)} tone
            <AiSourceLabel source={result} />
          </p>
          {result.warning && !note.isEdited && (
            <p className="flex items-start gap-2 bg-secondary-fixed/40 border border-secondary-fixed-dim text-on-secondary-fixed-variant rounded-xl px-3 py-2 text-[12px]">
              <Info size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
              {result.warning}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
