"use client"

import React from "react"
import { OutreachPromptsModal, createOutreachPromptsApi } from "@/components/outreach/OutreachPromptsModal"
import type { FirstMessagePromptId } from "@/constants/firstMessage"

const promptsApi = createOutreachPromptsApi("/api/first-messages/prompts")

interface FirstMessagePromptsModalProps {
  initialTab: FirstMessagePromptId | null
  onClose: () => void
}

/**
 * Edits the seven independent First Message tune prompts and the shared "About Me" sender profile.
 */
export const FirstMessagePromptsModal: React.FC<FirstMessagePromptsModalProps> = ({ initialTab, onClose }) => (
  <OutreachPromptsModal
    api={promptsApi}
    title="Update First Message Prompts"
    description="Each tune has its own independent prompt; saving one never changes another. About Me describes you and is shared by every tune."
    initialTab={initialTab}
    onClose={onClose}
  />
)
