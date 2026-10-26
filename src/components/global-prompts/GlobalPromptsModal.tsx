"use client"

import React from "react"
import { PromptTabsModal } from "@/components/prompts/PromptTabsModal"
import { requestApi } from "@/lib/apiClient"
import { getGlobalPromptUsage, type GlobalPromptId } from "@/constants/globalPrompts"
import type { GlobalPrompt } from "@/types/globalPrompts"
import type { EditablePrompt } from "@/types/prompts"

const variableChip = "font-code text-on-surface-variant bg-surface-container px-1 rounded"

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
  // The prompts this editor offers, one tab each: every account's, or the admin's own
  prompts: readonly { id: GlobalPromptId; label: string }[]
  // Where they are read and saved, which is what decides who may change them
  endpoint: string
  initialPrompt: GlobalPromptId | null
  onClose: () => void
}

/**
 * Edits the global prompts a page offers, one tab each. Saving one never changes another.
 */
export const GlobalPromptsModal: React.FC<GlobalPromptsModalProps> = ({ prompts, endpoint, initialPrompt, onClose }) => {
  const load = async (signal: AbortSignal): Promise<Record<GlobalPromptId, EditablePrompt>> => {
    const { data } = await requestApi<GlobalPrompt[]>(endpoint, { signal })
    const byId = {} as Record<GlobalPromptId, EditablePrompt>
    for (const prompt of data) byId[prompt.id] = prompt
    return byId
  }
  const save = (id: GlobalPromptId, prompt: string) =>
    requestApi<EditablePrompt>(`${endpoint}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    })

  return (
    <PromptTabsModal
      title="Update Global AI Prompts"
      description="Each global prompt is stored independently. Saving one never changes another."
      tabs={prompts.map(({ id, label }) => ({ id, label }))}
      initialTab={initialPrompt}
      loadPrompts={load}
      savePrompt={save}
      renderHint={renderHint}
      loadingText="Loading the global prompts..."
      onClose={onClose}
    />
  )
}
