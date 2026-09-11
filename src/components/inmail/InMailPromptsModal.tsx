"use client"

import React from "react"
import { OutreachPromptsModal, createOutreachPromptsApi } from "@/components/outreach/OutreachPromptsModal"
import type { InMailPromptId } from "@/constants/inmail"

const promptsApi = createOutreachPromptsApi("/api/inmail-messages/prompts")

interface InMailPromptsModalProps {
  initialTab: InMailPromptId | null
  onClose: () => void
}

/**
 * Edits the seven independent InMail tune prompts and the shared "About Me" sender profile.
 */
export const InMailPromptsModal: React.FC<InMailPromptsModalProps> = ({ initialTab, onClose }) => (
  <OutreachPromptsModal
    api={promptsApi}
    title="Update InMail Prompts"
    description="Each tune has its own independent prompt that writes both the subject and the message; saving one never changes another. About Me describes you and is shared with First Message."
    initialTab={initialTab}
    onClose={onClose}
  />
)
