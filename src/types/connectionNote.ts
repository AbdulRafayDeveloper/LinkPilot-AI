import type { ConnectionNoteToneId } from "@/constants/connectionNote"
import type { EditablePrompt } from "./prompts"
import type { WithAiSource } from "./ai"

export interface ConnectionNoteTonePrompt extends EditablePrompt {
  tone: ConnectionNoteToneId
}

export interface GeneratedConnectionNote extends WithAiSource {
  note: string
  tone: ConnectionNoteToneId
  characterCount: number
  maxCharacters: number
  warning: string | null
}
