import type { FirstMessagePromptId, FirstMessageTuneId } from "@/constants/firstMessage"
import type { EditablePrompt } from "./prompts"
import type { WithAiSource } from "./ai"

export interface FirstMessagePrompt extends EditablePrompt {
  id: FirstMessagePromptId
}

export interface GeneratedFirstMessage extends WithAiSource {
  message: string
  tune: FirstMessageTuneId
  characterCount: number
  maxCharacters: number
  // A voice note is judged in words: how many it is, and about how long it takes to say
  wordCount?: number
  speakingSeconds?: number
  warning: string | null
  usedSenderProfile: boolean
  analysis: {
    keyDetail: string
    senderLink: string | null
  }
}
