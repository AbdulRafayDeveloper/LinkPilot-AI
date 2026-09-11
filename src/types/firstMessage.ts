import type { FirstMessagePromptId, FirstMessageTuneId } from "@/constants/firstMessage"
import type { EditablePrompt } from "./prompts"

export interface FirstMessagePrompt extends EditablePrompt {
  id: FirstMessagePromptId
}

export interface GeneratedFirstMessage {
  message: string
  tune: FirstMessageTuneId
  characterCount: number
  maxCharacters: number
  warning: string | null
  usedSenderProfile: boolean
  analysis: {
    keyDetail: string
    senderLink: string | null
  }
}
