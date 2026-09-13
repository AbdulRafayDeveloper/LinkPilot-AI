"use client"

import React from "react"
import { PromptTabsModal } from "@/components/prompts/PromptTabsModal"
import { LeadSignalsPromptHint } from "@/components/lead-signals/LeadSignalsPromptHint"
import { requestApi } from "@/lib/apiClient"
import { FOLLOW_UP_PROMPT_TABS, type FollowUpPromptId } from "@/constants/followUp"
import { LEAD_SIGNALS_PROMPT_ID } from "@/constants/leadSignals"
import type { FollowUpPrompt } from "@/types/followUp"
import type { EditablePrompt } from "@/types/prompts"

const PROMPTS_ENDPOINT = "/api/follow-up-messages/prompts"
const variableChip = "font-code text-on-surface-variant bg-surface-container px-1 rounded"

async function loadFollowUpPrompts(signal: AbortSignal): Promise<Record<FollowUpPromptId, EditablePrompt>> {
  const { data } = await requestApi<FollowUpPrompt[]>(PROMPTS_ENDPOINT, { signal })
  const byId = {} as Record<FollowUpPromptId, EditablePrompt>
  for (const prompt of data) byId[prompt.id] = prompt
  return byId
}

function saveFollowUpPrompt(id: FollowUpPromptId, prompt: string) {
  return requestApi<EditablePrompt>(`${PROMPTS_ENDPOINT}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  })
}

function renderHint(id: FollowUpPromptId) {
  if (id === LEAD_SIGNALS_PROMPT_ID) return <LeadSignalsPromptHint />
  return (
    <p className="leading-relaxed">
      Variables: <code className={variableChip}>{"{{conversation}}"}</code> inserts the pasted conversation ·{" "}
      <code className={variableChip}>{"{{profile_data}}"}</code> inserts the profile information (or &quot;Not
      provided.&quot;) · <code className={variableChip}>{"{{follow_up_type}}"}</code> inserts the type name. Leave a
      variable out and its content is added at the end. The app always treats the conversation and profile as untrusted
      text.
    </p>
  )
}

interface FollowUpPromptsModalProps {
  initialTab: FollowUpPromptId | null
  onClose: () => void
}

/**
 * Edits the Non-Pitch, Pitch and Lead Signals prompts independently. Saving one never changes another.
 */
export const FollowUpPromptsModal: React.FC<FollowUpPromptsModalProps> = ({ initialTab, onClose }) => (
  <PromptTabsModal
    title="Update Follow-Up Prompts"
    description="Non-Pitch, Pitch and Lead Signals each have their own independent prompt. Saving one never changes another, and the next follow-up uses the saved version."
    tabs={FOLLOW_UP_PROMPT_TABS}
    initialTab={initialTab}
    loadPrompts={loadFollowUpPrompts}
    savePrompt={saveFollowUpPrompt}
    renderHint={renderHint}
    loadingText="Loading the saved follow-up prompts..."
    onClose={onClose}
  />
)
