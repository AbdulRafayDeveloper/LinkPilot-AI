"use client"

import React from "react"
import { AlertTriangle, Info, Loader2, RefreshCw, Reply } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import {
  REPLY_STAGE_TEXT,
  getReplyContextLabel,
  getReplyStyleLabel,
  type ReplyStage,
} from "@/constants/postCommentReplies"
import type { ReplyGenerationStatus } from "@/hooks/usePostCommentReplyGenerator"
import type { GeneratedReply } from "@/types/postCommentReplies"

interface ReplyResultProps {
  status: ReplyGenerationStatus
  stage: ReplyStage
  result: GeneratedReply | null
  error: string | null
  onRetry: () => void
}

const TITLE_ID = "post-comment-reply-result-title"
const centeredState = "flex-1 flex flex-col items-center justify-center text-center gap-3 px-4 py-6"

export const ReplyResult: React.FC<ReplyResultProps> = ({ status, stage, result, error, onRetry }) => (
  <section
    aria-labelledby={TITLE_ID}
    className="bg-white border border-outline-variant rounded-2xl shadow-sm p-5 flex flex-col gap-3 min-h-[220px] lg:min-h-[180px] lg:flex-1"
  >
    <div className="flex items-center justify-between gap-2 min-h-[26px]">
      <h2 id={TITLE_ID} className="text-sm font-bold text-on-surface">
        Generated Reply
      </h2>
      {status === "success" && result && <CopyButton text={result.reply} label="Copy reply" showLabel />}
    </div>

    {status === "idle" && (
      <div className={centeredState}>
        <div className="w-11 h-11 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
          <Reply size={20} aria-hidden="true" />
        </div>
        <p className="text-sm text-on-surface-variant max-w-xs leading-relaxed">
          Add the post if you have it, paste the comments, choose a reply style, and your reply will appear here.
        </p>
      </div>
    )}

    {status === "loading" && (
      <div role="status" aria-live="polite" className={centeredState}>
        <Loader2 size={22} className="animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold text-on-surface">{REPLY_STAGE_TEXT[stage]}</p>
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
        {result.replyingTo && (
          <p className="text-[11px] font-semibold text-outline truncate">Replying to {result.replyingTo}</p>
        )}
        <blockquote className="min-h-0 max-h-[50vh] lg:max-h-none overflow-y-auto text-[15px] leading-relaxed text-on-surface whitespace-pre-wrap break-words border-l-2 border-primary bg-surface-container-lowest rounded-r-xl px-4 py-3">
          {result.reply}
        </blockquote>
        <p className="text-[11px] text-outline">
          <span className={result.characterCount > result.maxCharacters ? "text-error font-semibold" : ""}>
            {result.characterCount.toLocaleString()} / {result.maxCharacters.toLocaleString()} characters
          </span>{" "}
          · {getReplyContextLabel(result.context)} · {getReplyStyleLabel(result.style)}
        </p>
        {result.warning && (
          <p className="flex items-start gap-2 bg-secondary-fixed/40 border border-secondary-fixed-dim text-on-secondary-fixed-variant rounded-xl px-3 py-2 text-[12px]">
            <Info size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
            {result.warning}
          </p>
        )}
        {result.extractedPost && (
          <details className="border-t border-outline-variant/60 pt-2">
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
