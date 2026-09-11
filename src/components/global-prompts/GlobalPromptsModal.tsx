"use client"

import React from "react"
import { PromptTabsModal } from "@/components/prompts/PromptTabsModal"
import { requestApi } from "@/lib/apiClient"
import { GLOBAL_PROMPTS, getGlobalPromptUsage, type GlobalPromptId } from "@/constants/globalPrompts"
import type { GlobalPrompt } from "@/types/globalPrompts"
import type { EditablePrompt } from "@/types/prompts"

const PROMPTS_ENDPOINT = "/api/global-prompts"
const TABS = GLOBAL_PROMPTS.map(({ id, label }) => ({ id, label }))
const variableChip = "font-code text-on-surface-variant bg-surface-container px-1 rounded"

async function loadGlobalPrompts(signal: AbortSignal): Promise<Record<GlobalPromptId, EditablePrompt>> {
  const { data } = await requestApi<GlobalPrompt[]>(PROMPTS_ENDPOINT, { signal })
  const byId = {} as Record<GlobalPromptId, EditablePrompt>
  for (const prompt of data) byId[prompt.id] = prompt
  return byId
}

function saveGlobalPrompt(id: GlobalPromptId, prompt: string) {
  return requestApi<EditablePrompt>(`${PROMPTS_ENDPOINT}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  })
}

const renderHint = (id: GlobalPromptId) => (
  <p className="leading-relaxed">
    {id === "humanization" ? (
      <>
        <code className={variableChip}>{"{{text}}"}</code> marks where the text to humanize goes.{" "}
      </>
    ) : (
      "Keep this to facts you're happy for the AI to use about you. "
    )}
    {getGlobalPromptUsage(id)}.
  </p>
)

interface GlobalPromptsModalProps {
  initialPrompt: GlobalPromptId | null
  onClose: () => void
}

/**
 * Edits the global prompts, one tab each. Saving one never changes the other.
 */
export const GlobalPromptsModal: React.FC<GlobalPromptsModalProps> = ({ initialPrompt, onClose }) => (
  <PromptTabsModal
    title="Update Global AI Prompts"
    description="Each global prompt is stored independently. Saving one never changes the other."
    tabs={TABS}
    initialTab={initialPrompt}
    loadPrompts={loadGlobalPrompts}
    savePrompt={saveGlobalPrompt}
    renderHint={renderHint}
    loadingText="Loading the global prompts..."
    onClose={onClose}
  />
)
