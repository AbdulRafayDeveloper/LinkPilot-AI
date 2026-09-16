import type { PromptTargetId } from "@/constants/promptCreator"
import type { EditablePrompt } from "./prompts"

export interface PromptTargetPrompt extends EditablePrompt {
  target: PromptTargetId
}

// How the user described the task
export type RequestSource = "text" | "voice"

/**
 * A prompt the module wrote, as the page shows it and the database keeps it.
 */
export interface CreatedPrompt {
  id: string
  name: string
  prompt: string
  target: PromptTargetId
  // What the user described, so the saved prompt can be traced back to the request
  request: string
  requestSource: RequestSource
  createdAt: string
  updatedAt: string
}
