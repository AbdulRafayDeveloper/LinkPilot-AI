"use client"

import React from "react"
import { PromptTabsModal, type PromptTab } from "@/components/prompts/PromptTabsModal"
import { requestApi } from "@/lib/apiClient"
import { ABOUT_ME_TAB_ID } from "@/constants/outreachTunes"
import type { EditablePrompt } from "@/types/prompts"

export interface OutreachPromptsApi<Id extends string> {
  loadPrompts: (signal: AbortSignal) => Promise<Record<Id, EditablePrompt>>
  savePrompt: (id: Id, prompt: string) => Promise<{ data: EditablePrompt; message?: string }>
}

/**
 * Builds the prompt endpoints for a module. Call it at module level so the functions
 * stay stable across renders (the modal refetches when they change).
 */
export function createOutreachPromptsApi<Id extends string>(endpoint: string): OutreachPromptsApi<Id> {
  return {
    async loadPrompts(signal) {
      const { data } = await requestApi<Array<EditablePrompt & { id: Id }>>(endpoint, { signal })
      const byId = {} as Record<Id, EditablePrompt>
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

function renderHint(id: string) {
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
      leave them out; any other <code className={variableChip}>{"{{…}}"}</code> slot is filled in by the AI from them. The
      pasted profile is always treated as untrusted text.
    </p>
  )
}

interface OutreachPromptsModalProps<Id extends string> {
  api: OutreachPromptsApi<Id>
  // The module's tunes plus About Me, in tab order
  tabs: readonly PromptTab<Id>[]
  title: string
  description: string
  initialTab: Id | null
  onClose: () => void
}

/**
 * Edits a module's independent tune prompts plus the shared "About Me" sender profile.
 */
export function OutreachPromptsModal<Id extends string>({
  api,
  tabs,
  title,
  description,
  initialTab,
  onClose,
}: OutreachPromptsModalProps<Id>) {
  return (
    <PromptTabsModal
      title={title}
      description={description}
      tabs={tabs}
      initialTab={initialTab}
      loadPrompts={api.loadPrompts}
      savePrompt={api.savePrompt}
      renderHint={renderHint}
      loadingText="Loading the saved tune prompts..."
      onClose={onClose}
    />
  )
}
