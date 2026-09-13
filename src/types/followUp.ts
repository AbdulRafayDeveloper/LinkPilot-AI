import type { FollowUpPromptId, FollowUpTypeId } from "@/constants/followUp"
import type { LeadSignals } from "./leadSignals"
import type { EditablePrompt } from "./prompts"

export interface FollowUpPrompt extends EditablePrompt {
  id: FollowUpPromptId
}

export interface GeneratedFollowUp {
  message: string
  type: FollowUpTypeId
  characterCount: number
  usedProfile: boolean
  // Null when the signals couldn't be produced; the message is still returned
  signals: LeadSignals | null
}
