import type { FollowUpTypeId } from "@/constants/followUp"
import type { ConversationParties } from "./conversation"
import type { EditablePrompt } from "./prompts"

export interface FollowUpTypePrompt extends EditablePrompt {
  type: FollowUpTypeId
}

export interface ConversationReading extends ConversationParties {
  summary: string
}

export interface GeneratedFollowUp {
  message: string
  type: FollowUpTypeId
  characterCount: number
  usedProfile: boolean
  reading: ConversationReading
}
