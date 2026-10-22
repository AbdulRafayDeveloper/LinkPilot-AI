"use client"

import React from "react"
import { HelpCircle, Loader2 } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { CLIENT_VOICES_MESSAGES } from "@/constants/clientVoices"
import type { ClientQuestion } from "@/types/clientVoices"

interface QuestionListPanelProps {
  questions: ClientQuestion[] | null
  isWorking: boolean
  // Said before a batch has been run at all, so the panel is never a bare empty box
  waitingLabel?: string
}

/**
 * What the client **asked**, kept apart from what they asked for, at the owner's request. A task is
 * something to do and a question is something to answer, so a question folded into the task list is
 * either lost or turned into work nobody wanted. The voice it was asked in is a quiet label, as it
 * is on a task, and Copy puts the questions on the clipboard as plain lines with nothing around them.
 */
export const QuestionListPanel: React.FC<QuestionListPanelProps> = ({ questions, isWorking, waitingLabel }) => {
  const plainText = (questions ?? []).map((entry) => `- ${entry.question}`).join("\n")

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-on-surface">
          <HelpCircle size={16} className="text-primary" aria-hidden="true" />
          What the client asked
        </h2>
        {questions && questions.length > 0 && (
          <CopyButton text={plainText} label="Copy all questions" variant="prominent" buttonText="Copy All Questions" />
        )}
      </div>

      {isWorking && (
        <p className="flex items-center gap-2 text-[12px] text-on-surface-variant" role="status">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          Reading the transcripts for anything they asked...
        </p>
      )}

      {!isWorking && questions && questions.length === 0 && (
        <p className="text-[12px] text-on-surface-variant">{CLIENT_VOICES_MESSAGES.questionsEmpty}</p>
      )}

      {!isWorking && !questions && waitingLabel && <p className="text-[12px] text-on-surface-variant">{waitingLabel}</p>}

      {questions && questions.length > 0 && (
        <ol className="flex flex-col gap-2">
          {questions.map((entry, index) => (
            <li
              key={`${index}-${entry.question.slice(0, 24)}`}
              className="flex gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-secondary-fixed text-[11px] font-bold text-on-secondary-fixed-variant">
                ?
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-[13px] leading-relaxed text-on-surface">{entry.question}</p>
                {entry.voices.length > 0 && (
                  <p className="mt-0.5 text-[11px] text-outline">({entry.voices.map((voice) => `Voice ${voice}`).join(", ")})</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
