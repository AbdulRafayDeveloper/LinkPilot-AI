"use client"

import React from "react"
import { PromptTabsModal } from "@/components/prompts/PromptTabsModal"
import { requestApi } from "@/lib/apiClient"
import { PROMPT_CREATOR_ENDPOINT, PROMPT_TARGETS, PROMPT_TARGET_TABS, type PromptTargetId } from "@/constants/promptCreator"
import type { PromptTargetPrompt } from "@/types/promptCreator"

const PROMPTS_ENDPOINT = `${PROMPT_CREATOR_ENDPOINT}/prompts`
const REQUEST_VARIABLE = "{{request}}"

async function loadTargetPrompts(signal: AbortSignal): Promise<Record<PromptTargetId, PromptTargetPrompt>> {
  const { data } = await requestApi<PromptTargetPrompt[]>(PROMPTS_ENDPOINT, { signal })
  return Object.fromEntries(data.map((entry) => [entry.target, entry])) as Record<PromptTargetId, PromptTargetPrompt>
}

function saveTargetPrompt(target: PromptTargetId, prompt: string) {
  return requestApi<PromptTargetPrompt>(`${PROMPTS_ENDPOINT}/${target}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  })
}

const renderTargetHint = (target: PromptTargetId, draft: string) => (
  <div className="space-y-1 leading-relaxed">
    <p className="font-semibold text-on-surface-variant">{PROMPT_TARGETS.find((option) => option.id === target)?.description}</p>
    <p>
      <code className="font-code text-on-surface-variant">{REQUEST_VARIABLE}</code> is where what you described goes.{" "}
      {draft.includes(REQUEST_VARIABLE)
        ? "This prompt places it itself."
        : "This prompt does not place it, so it is added at the end."}
    </p>
    <p>Every prompt written from this comes out in English, ready to paste, and is saved with its own name.</p>
  </div>
)

interface PromptCreatorPromptsModalProps {
  initialTarget: PromptTargetId | null
  onClose: () => void
}

/**
 * Edits the two independent Prompt Creator prompts, one per target. Saving one never changes the other.
 */
export const PromptCreatorPromptsModal: React.FC<PromptCreatorPromptsModalProps> = ({ initialTarget, onClose }) => (
  <PromptTabsModal
    title="Update Prompt Creator Prompts"
    description="Each target has its own independent prompt that decides how your finished prompt is shaped. Saving one never changes the other."
    tabs={PROMPT_TARGET_TABS}
    initialTab={initialTarget}
    loadPrompts={loadTargetPrompts}
    savePrompt={saveTargetPrompt}
    renderHint={renderTargetHint}
    loadingText="Loading the saved Prompt Creator prompts..."
    onClose={onClose}
  />
)
