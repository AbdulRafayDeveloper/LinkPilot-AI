"use client"

import React from "react"
import { PromptTabsModal } from "@/components/prompts/PromptTabsModal"
import { requestApi } from "@/lib/apiClient"
import {
  COMMENT_MAX_CHARS,
  COMMENT_PROMPT_VARIABLES,
  COMMENT_TUNES,
  promptUsesVariable,
  type CommentTuneId,
} from "@/constants/commentWriter"
import type { CommentTunePrompt } from "@/types/commentWriter"

const PROMPTS_ENDPOINT = "/api/comment-writer/prompts"
const TABS = COMMENT_TUNES.map((tune) => ({ id: tune.id, label: tune.label }))

async function loadTunePrompts(signal: AbortSignal): Promise<Record<CommentTuneId, CommentTunePrompt>> {
  const { data } = await requestApi<CommentTunePrompt[]>(PROMPTS_ENDPOINT, { signal })
  return Object.fromEntries(data.map((entry) => [entry.tune, entry])) as Record<CommentTuneId, CommentTunePrompt>
}

function saveTunePrompt(tune: CommentTuneId, prompt: string) {
  return requestApi<CommentTunePrompt>(`${PROMPTS_ENDPOINT}/${tune}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  })
}

function describeDataSources(draft: string): string {
  const sources = [
    promptUsesVariable(draft, "research_context") && "runs live web research",
    promptUsesVariable(draft, "user_experience") && "uses your About Me profile",
  ].filter(Boolean)
  return sources.length > 0 ? `This prompt ${sources.join(" and ")}.` : "This prompt uses only the post."
}

const renderTuneHint = (_tune: CommentTuneId, draft: string) => (
  <div className="space-y-1 leading-relaxed">
    <p className="font-semibold text-on-surface-variant">{describeDataSources(draft)}</p>
    <details>
      <summary className="cursor-pointer font-semibold hover:text-primary">Optional variables</summary>
      <ul className="mt-1 space-y-0.5">
        {COMMENT_PROMPT_VARIABLES.map((variable) => (
          <li key={variable.name}>
            <code className="font-code text-on-surface-variant">{`{{${variable.name}}}`}</code> {variable.description}
          </li>
        ))}
      </ul>
    </details>
    <p>
      The app always treats the post as untrusted text, keeps comments within LinkedIn&apos;s{" "}
      {COMMENT_MAX_CHARS.toLocaleString()}-character limit, and never claims experience or recent news it can&apos;t
      verify.
    </p>
  </div>
)

interface TunePromptsModalProps {
  initialTune: CommentTuneId | null
  onClose: () => void
}

/**
 * Edits the six independent tune prompts. Saving one tune never changes the others.
 */
export const TunePromptsModal: React.FC<TunePromptsModalProps> = ({ initialTune, onClose }) => (
  <PromptTabsModal
    title="Update Comment Writer Prompts"
    description="Each comment style has its own independent prompt. Saving one never changes the others, and future comments in that style use the saved version."
    tabs={TABS}
    initialTab={initialTune}
    loadPrompts={loadTunePrompts}
    savePrompt={saveTunePrompt}
    renderHint={renderTuneHint}
    loadingText="Loading the saved comment style prompts..."
    onClose={onClose}
  />
)
