import type { GlobalPromptId } from "@/constants/globalPrompts"
import type { EditablePrompt } from "./prompts"

export interface GlobalPrompt extends EditablePrompt {
  id: GlobalPromptId
}
