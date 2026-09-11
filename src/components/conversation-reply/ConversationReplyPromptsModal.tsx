"use client"

import React from "react"
import { PromptTabsModal } from "@/components/prompts/PromptTabsModal"
import { requestApi } from "@/lib/apiClient"
import {
  ABOUT_ME_TAB_ID,
  CONVERSATION_REPLY_PROMPT_TABS,
  type ConversationReplyPromptId,
} from "@/constants/conversationReply"
import type { ConversationReplyPrompt } from "@/types/conversationReply"
import type { EditablePrompt } from "@/types/prompts"

const PROMPTS_ENDPOINT = "/api/conversation-replies/prompts"
const variableChip = "font-code text-on-surface-variant bg-surface-container px-1 rounded"

async function loadPrompts(signal: AbortSignal): Promise<Record<ConversationReplyPromptId, EditablePrompt>> {
  const { data } = await requestApi<ConversationReplyPrompt[]>(PROMPTS_ENDPOINT, { signal })
  const byId = {} as Record<ConversationReplyPromptId, EditablePrompt>
  for (const prompt of data) byId[prompt.id] = prompt
  return byId
}

function savePrompt(id: ConversationReplyPromptId, prompt: string) {
  return requestApi<EditablePrompt>(`${PROMPTS_ENDPOINT}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  })
}

function renderHint(id: ConversationReplyPromptId) {
  if (id === ABOUT_ME_TAB_ID) {
    return (
      <p className="leading-relaxed">
        Shared with the other outreach tools through <code className={variableChip}>{"{{sender_profile}}"}</code>. It&apos;s
        the only source of facts about you, and it also feeds Opportunity Fit. While it&apos;s still the template, replies
        won&apos;t describe your services or experience.
      </p>
    )
  }
  return (
    <p className="leading-relaxed">
      Variables: <code className={variableChip}>{"{{conversation}}"}</code> the pasted conversation ·{" "}
      <code className={variableChip}>{"{{profile_data}}"}</code> their profile ·{" "}
      <code className={variableChip}>{"{{sender_profile}}"}</code> your About Me ·{" "}
      <code className={variableChip}>{"{{conversation_analysis}}"}</code> the objective analysis ·{" "}
      <code className={variableChip}>{"{{reply_type}}"}</code> the type name. Blocks you leave out are added at the end.
      This prompt steers the reply only. The signals are analyzed separately, so they never depend on the reply type.
    </p>
  )
}

interface ConversationReplyPromptsModalProps {
  initialTab: ConversationReplyPromptId
  onClose: () => void
}

/**
 * Edits the five independent reply-type prompts and the shared "About Me" sender profile.
 */
export const ConversationReplyPromptsModal: React.FC<ConversationReplyPromptsModalProps> = ({ initialTab, onClose }) => (
  <PromptTabsModal
    title="Update Conversation Reply Prompts"
    description="Each reply type has its own independent prompt; saving one never changes another. About Me describes you and is shared across tools."
    tabs={CONVERSATION_REPLY_PROMPT_TABS}
    initialTab={initialTab}
    loadPrompts={loadPrompts}
    savePrompt={savePrompt}
    renderHint={renderHint}
    loadingText="Loading the saved reply prompts..."
    onClose={onClose}
  />
)
