"use client"

import React from "react"
import { PromptTabsModal } from "@/components/prompts/PromptTabsModal"
import { requestApi } from "@/lib/apiClient"
import { ABOUT_ME_TAB_ID, OUTREACH_PROMPT_TABS, type OutreachPromptId } from "@/constants/outreachTunes"
import type { EditablePrompt } from "@/types/prompts"

export interface OutreachPromptsApi {
  loadPrompts: (signal: AbortSignal) => Promise<Record<OutreachPromptId, EditablePrompt>>
  savePrompt: (id: OutreachPromptId, prompt: string) => Promise<{ data: EditablePrompt; message?: string }>
}

/**
 * Builds the prompt endpoints for a module. Call it at module level so the functions
 * stay stable across renders (the modal refetches when they change).
 */
export function createOutreachPromptsApi(endpoint: string): OutreachPromptsApi {
  return {
    async loadPrompts(signal) {
      const { data } = await requestApi<Array<EditablePrompt & { id: OutreachPromptId }>>(endpoint, { signal })
      const byId = {} as Record<OutreachPromptId, EditablePrompt>
      for (const prompt of data) byId[prompt.id] = prompt
      return byId
    },
    savePrompt(id, prompt) {
      return requestApi<EditablePrompt>(`${endpoint}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })
    },
  }
}

const variableChip = "font-code text-on-surface-variant bg-surface-container px-1 rounded"

function renderHint(id: OutreachPromptId) {
  if (id === ABOUT_ME_TAB_ID) {
    return (
      <p className="leading-relaxed">
        Shared by every tune in First Message and InMail through{" "}
        <code className={variableChip}>{"{{sender_profile}}"}</code>. It&apos;s the only source of facts about you:
        while it&apos;s still the template, nothing is written about your services or experience.
      </p>
    )
  }
  return (
    <p className="leading-relaxed">
      Variables: <code className={variableChip}>{"{{profile_data}}"}</code> the pasted profile ·{" "}
      <code className={variableChip}>{"{{sender_profile}}"}</code> your About Me ·{" "}
      <code className={variableChip}>{"{{tune}}"}</code> the tune name. Profile and About Me are added at the end if you
      leave them out. The pasted profile is always treated as untrusted text.
    </p>
  )
}

interface OutreachPromptsModalProps {
  api: OutreachPromptsApi
  title: string
  description: string
  initialTab: OutreachPromptId | null
  onClose: () => void
}

/**
 * Edits a module's seven independent tune prompts plus the shared "About Me" sender profile.
 */
export const OutreachPromptsModal: React.FC<OutreachPromptsModalProps> = ({ api, title, description, initialTab, onClose }) => (
  <PromptTabsModal
    title={title}
    description={description}
    tabs={OUTREACH_PROMPT_TABS}
    initialTab={initialTab}
    loadPrompts={api.loadPrompts}
    savePrompt={api.savePrompt}
    renderHint={renderHint}
    loadingText="Loading the saved tune prompts..."
    orientation="vertical"
    onClose={onClose}
  />
)
