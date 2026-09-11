import type { ConnectionNoteToneId } from "@/constants/connectionNote"
import type { EditablePrompt } from "./prompts"

export interface ConnectionNoteTonePrompt extends EditablePrompt {
  tone: ConnectionNoteToneId
}

export interface GeneratedConnectionNote {
  note: string
  tone: ConnectionNoteToneId
  characterCount: number
  maxCharacters: number
  warning: string | null
}
