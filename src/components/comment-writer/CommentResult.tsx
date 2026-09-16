"use client"

import React from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  MessageSquareText,
  RefreshCw,
} from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { EditableOutput } from "@/components/ui/EditableOutput"
import { useEditableText } from "@/lib/outputEdits"
import { getTuneLabel } from "@/constants/commentWriter"
import type { CommentStageEntry, CommentWriterStatus } from "@/hooks/useCommentGenerator"
import type { GeneratedComment } from "@/types/commentWriter"

const PROVIDER_LABELS: Record<GeneratedComment["provider"], string> = {
  gemini: "Gemini",
  openai: "OpenAI",
}

interface CommentResultProps {
  status: CommentWriterStatus
  result: GeneratedComment | null
  stages: CommentStageEntry[]
  error: string | null
  onRegenerate: () => void
}

const centeredState = "flex-1 flex flex-col items-center justify-center text-center gap-3 px-4 py-8"

const StageList: React.FC<{ stages: CommentStageEntry[] }> = ({ stages }) => (
  <ol className="space-y-2 text-left">
    {stages.map((stage, index) => {
      const isActive = index === stages.length - 1
      return (
        <li key={`${stage.status}-${index}`} className="flex items-center gap-2 text-[13px]">
          {isActive ? (
            <Loader2 size={14} className="animate-spin text-primary shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 size={14} className="text-primary shrink-0" aria-hidden="true" />
          )}
          <span className={isActive ? "text-on-surface font-medium" : "text-on-surface-variant"}>{stage.text}</span>
        </li>
      )
    })}
  </ol>
)

const RegenerateButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-2 px-4 py-2 border border-outline-variant bg-white text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors"
  >
    <RefreshCw size={15} aria-hidden="true" />
    {label}
  </button>
)

export const CommentResult = React.forwardRef<HTMLElement, CommentResultProps>(function CommentResult(
  { status, result, stages, error, onRegenerate },
  ref
) {
  // The comment as the user edits it; copy and the count follow the edits
  const comment = useEditableText("comment-writer", result?.comment ?? "")

  return (
    <section
      ref={ref}
      aria-labelledby="comment-writer-result-title"
      className="bg-white border border-outline-variant rounded-2xl shadow-sm p-5 flex flex-col gap-3 min-h-[260px] lg:min-h-0 scroll-mt-4"
    >
      <div className="flex items-center justify-between gap-2 min-h-[26px]">
        <h2 id="comment-writer-result-title" className="text-sm font-bold text-on-surface">
          Generated Comment
        </h2>
        {status === "success" && result && <CopyButton text={comment.value} label="Copy comment" showLabel />}
      </div>

      {status === "idle" && (
        <div className={centeredState}>
          <div className="w-11 h-11 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
            <MessageSquareText size={20} aria-hidden="true" />
          </div>
          <p className="text-sm text-on-surface-variant max-w-xs leading-relaxed">
            Paste a post or upload a screenshot, choose a comment style, and generate a comment worth posting.
          </p>
        </div>
      )}

      {status === "loading" && (
        <div role="status" aria-live="polite" className={centeredState}>
          <Loader2 size={22} className="animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold text-on-surface">Analyzing post and writing your comment...</p>
          {stages.length > 0 && <StageList stages={stages} />}
        </div>
      )}

      {status === "error" && (
        <div role="alert" className={centeredState}>
          <div className="w-11 h-11 rounded-2xl bg-error-container flex items-center justify-center text-error">
            <AlertTriangle size={20} aria-hidden="true" />
          </div>
          <p className="text-sm text-on-surface-variant max-w-xs leading-relaxed">{error}</p>
          <RegenerateButton onClick={onRegenerate} label="Try again" />
        </div>
      )}

      {status === "success" && result && (
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          <EditableOutput text={comment} label="Comment" />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-outline">
              <span className={comment.value.length > result.maxCharacters ? "text-error font-semibold" : ""}>
                {comment.value.length.toLocaleString()} / {result.maxCharacters.toLocaleString()} characters
              </span>{" "}
              ·{" "}
              {getTuneLabel(result.tune)} · Written with {PROVIDER_LABELS[result.provider]}
            </p>
            <button
              type="button"
              onClick={onRegenerate}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-outline hover:text-primary hover:bg-surface-container transition-colors"
            >
              <RefreshCw size={13} aria-hidden="true" />
              Regenerate
            </button>
          </div>

          {result.reference && (
            <div className="rounded-xl border border-outline-variant px-3 py-2">
              <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-1">Reference</p>
              <div className="flex items-center gap-1 min-w-0">
                <a
                  href={result.reference.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/link flex-1 min-w-0 flex items-center gap-2 rounded-lg py-0.5 hover:text-primary"
                >
                  <ExternalLink size={14} className="shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-on-surface group-hover/link:text-primary">
                      {result.reference.title}
                    </span>
                    <span className="block truncate text-[11px] text-outline">{result.reference.source}</span>
                  </span>
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
                <CopyButton text={result.reference.url} label="Copy reference link" />
              </div>
            </div>
          )}

          {result.notices.map((notice) => (
            <p
              key={notice}
              className="flex items-start gap-2 bg-secondary-fixed/40 border border-secondary-fixed-dim text-on-secondary-fixed-variant rounded-xl px-3 py-2 text-[12px]"
            >
              <Info size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
              {notice}
            </p>
          ))}

          {result.extractedPost && (
            <details className="group border-t border-outline-variant/60 pt-2">
              <summary className="cursor-pointer text-[11px] font-semibold text-on-surface-variant hover:text-primary rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                Text read from your screenshot
              </summary>
              <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-surface-container-lowest border border-outline-variant/60 p-2 text-[12px] leading-relaxed text-on-surface-variant">
                {result.extractedPost}
              </p>
            </details>
          )}
        </div>
      )}
    </section>
  )
})
