import type { PromptTargetId } from "@/constants/promptCreator"
import type { AiProviderId } from "@/constants/aiProviders"
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
  // Who wrote it (Groq, or OpenAI as the fallback); prompts saved before this was kept have none
  provider: AiProviderId | null
  createdAt: string
  updatedAt: string
}
