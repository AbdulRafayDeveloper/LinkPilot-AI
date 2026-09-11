"use client"

import React from "react"
import { PromptTabsModal } from "@/components/prompts/PromptTabsModal"
import { requestApi } from "@/lib/apiClient"
import { FOLLOW_UP_TYPES, type FollowUpTypeId } from "@/constants/followUp"
import type { FollowUpTypePrompt } from "@/types/followUp"

const PROMPTS_ENDPOINT = "/api/follow-up-messages/prompts"

async function loadFollowUpPrompts(signal: AbortSignal): Promise<Record<FollowUpTypeId, FollowUpTypePrompt>> {
  const { data } = await requestApi<FollowUpTypePrompt[]>(PROMPTS_ENDPOINT, { signal })
  return Object.fromEntries(data.map((entry) => [entry.type, entry])) as Record<FollowUpTypeId, FollowUpTypePrompt>
}

function saveFollowUpPrompt(type: FollowUpTypeId, prompt: string) {
  return requestApi<FollowUpTypePrompt>(`${PROMPTS_ENDPOINT}/${type}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  })
}

const renderVariablesHint = () => (
  <p className="leading-relaxed">
    Variables: <code className="font-code text-on-surface-variant">{"{{conversation}}"}</code> inserts the pasted
    conversation · <code className="font-code text-on-surface-variant">{"{{profile_data}}"}</code> inserts the profile
    information (or &quot;Not provided.&quot;) · <code className="font-code text-on-surface-variant">{"{{follow_up_type}}"}</code>{" "}
    inserts the type name. Leave a variable out and its content is added at the end. The app always treats the
    conversation and profile as untrusted text.
  </p>
)

interface FollowUpPromptsModalProps {
  initialType: FollowUpTypeId | null
  onClose: () => void
}

/**
 * Edits the Non-Pitch and Pitch prompts independently. Saving one never changes the other.
 */
export const FollowUpPromptsModal: React.FC<FollowUpPromptsModalProps> = ({ initialType, onClose }) => (
  <PromptTabsModal
    title="Update Follow-Up Prompts"
    description="Non-Pitch and Pitch follow-ups each have their own independent prompt. Saving one never changes the other, and future messages of that type use the saved version."
    tabs={FOLLOW_UP_TYPES}
    initialTab={initialType}
    loadPrompts={loadFollowUpPrompts}
    savePrompt={saveFollowUpPrompt}
    renderHint={renderVariablesHint}
    loadingText="Loading the saved follow-up prompts..."
    onClose={onClose}
  />
)
