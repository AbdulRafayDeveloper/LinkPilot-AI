"use client"

import React from "react"
import { OutreachPromptsModal, createOutreachPromptsApi } from "@/components/outreach/OutreachPromptsModal"
import { FIRST_MESSAGE_PROMPT_TABS, type FirstMessagePromptId } from "@/constants/firstMessage"

const promptsApi = createOutreachPromptsApi<FirstMessagePromptId>("/api/first-messages/prompts")

interface FirstMessagePromptsModalProps {
  initialTab: FirstMessagePromptId | null
  onClose: () => void
}

/**
 * Edits the five independent First Message tone prompts and the shared "About Me" sender profile.
 */
export const FirstMessagePromptsModal: React.FC<FirstMessagePromptsModalProps> = ({ initialTab, onClose }) => (
  <OutreachPromptsModal
    api={promptsApi}
    tabs={FIRST_MESSAGE_PROMPT_TABS}
    title="Update First Message Prompts"
    description="Each tone has its own independent prompt; saving one never changes another. About Me describes you and is shared by every tone."
    initialTab={initialTab}
    onClose={onClose}
  />
)
