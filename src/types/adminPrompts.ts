import type { EditablePrompt } from "@/types/prompts"

/** One stored prompt as Administration → Global AI Prompts reads it. */
export interface AdminPrompt extends EditablePrompt {
  key: string
  // False for a system prompt (rules and wording the module always sends), true for one its users choose
  editable: boolean
  // What it is for and where it is used, for the admin; "" when nobody has described it yet
  description: string
}

/** One module that has prompts stored: its `tool` value, how many, and how many are system prompts. */
export interface PromptModuleStats {
  tool: string
  total: number
  system: number
}
