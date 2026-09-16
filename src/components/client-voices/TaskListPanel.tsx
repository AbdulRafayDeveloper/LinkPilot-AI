"use client"

import React from "react"
import { AlertTriangle, ListChecks, Loader2 } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import type { TaskExtraction } from "@/types/clientVoices"

interface TaskListPanelProps {
  result: TaskExtraction | null
  isWorking: boolean
  error: string | null
  onRetry: () => void
}

/**
 * The one list the whole batch comes down to: what the client actually asked for, in order,
 * with the voice it was asked in as a quiet label rather than a heading. Copy All Tasks puts
 * the list on the clipboard as plain lines, with nothing from the page around it.
 */
export const TaskListPanel: React.FC<TaskListPanelProps> = ({ result, isWorking, error, onRetry }) => {
  // What lands on the clipboard: the tasks themselves, one per line, ready to paste anywhere
  const plainText = (result?.tasks ?? []).map((task) => `- ${task.task}`).join("\n")

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-on-surface">
          <ListChecks size={16} className="text-primary" aria-hidden="true" />
          What the client asked for
        </h2>
        {result && result.tasks.length > 0 && (
          <CopyButton text={plainText} label="Copy all tasks" variant="prominent" buttonText="Copy All Tasks" />
        )}
      </div>

      {isWorking && (
        <p className="flex items-center gap-2 text-[12px] text-on-surface-variant" role="status">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          Reading the transcripts and writing the list...
        </p>
      )}

      {error && !isWorking && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-error/40 bg-error-container px-3 py-2 text-[12px] text-error">
          <AlertTriangle size={14} aria-hidden="true" />
          {error}
          <button type="button" onClick={onRetry} className="font-semibold underline hover:no-underline">
            Try again
          </button>
        </div>
      )}

      {result && result.missingVoices.length > 0 && (
        <p className="rounded-xl bg-secondary-container px-3 py-2 text-[12px] text-on-secondary-container">
          This list is from the voices that worked. Voice {result.missingVoices.join(", voice ")} could not be written
          out, so nothing asked for there is in it.
        </p>
      )}

      {result && result.tasks.length === 0 && !isWorking && (
        <p className="text-[12px] text-on-surface-variant">
          The client did not ask for anything that reads as work in these voices.
        </p>
      )}

      {result && result.tasks.length > 0 && (
        <ol className="flex flex-col gap-2">
          {result.tasks.map((task, index) => (
            <li
              key={`${index}-${task.task.slice(0, 24)}`}
              className="flex gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-[11px] font-bold text-primary">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-[13px] leading-relaxed text-on-surface">{task.task}</p>
                {task.voices.length > 0 && (
                  <p className="mt-0.5 text-[11px] text-outline">
                    ({task.voices.map((voice) => `Voice ${voice}`).join(", ")})
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {!result && !isWorking && !error && (
        <p className="text-[12px] text-on-surface-variant">
          Add the client&apos;s voice messages and transcribe them. The list of what they asked for lands here.
        </p>
      )}
    </section>
  )
}
