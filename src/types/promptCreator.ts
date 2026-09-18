import type { PromptTargetId } from "@/constants/promptCreator"
import type { AiProviderId } from "@/constants/aiProviders"
import type { EditablePrompt } from "./prompts"

export interface PromptTargetPrompt extends EditablePrompt {
  target: PromptTargetId
}

// How the user described the task
export type RequestSource = "text" | "voice"

/**
 * One prompt another prompt waits for: enough to name it and to say whether it has run, which is
 * what applying it means (constants/promptDependencies.ts).
 */
export interface PromptDependency {
  id: string
  name: string
  appliedAt: string | null
}

/**
 * A prompt the module wrote, as the page shows it and the database keeps it.
 */
export interface CreatedPrompt {
  // Empty for a prompt kept temporarily: it was never saved, so there is nothing to change later
  id: string
  name: string
  prompt: string
  target: PromptTargetId
  // What the user described, so the saved prompt can be traced back to the request
  request: string
  requestSource: RequestSource
  // The folder it is filed in, null for a prompt in no folder
  folderId: string | null
  // The project it was written for, null for one written outside any
  projectId: string | null
  // When the user marked it as applied (used), or null while it is unused
  appliedAt: string | null
  // The prompts this one waits for, in the order they are to be worked in; empty for an independent
  // prompt, which is also how every prompt saved before dependencies existed reads
  dependencies: PromptDependency[]
  // Who wrote it (Groq, or OpenAI as the fallback); prompts saved before this was kept have none
  provider: AiProviderId | null
  providers?: AiProviderId[]
  createdAt: string
  updatedAt: string
}
