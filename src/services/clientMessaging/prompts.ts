import { getStoredPrompt, saveStoredPrompt } from "@/services/promptStore"
import type { EditablePrompt } from "@/types/prompts"

/**
 * The module's one overall prompt: how a formal client message is written. Every channel and
 * every client goes through it, with the client's own format and samples placed inside it.
 */
export function getClientMessagePrompt(): Promise<EditablePrompt> {
  return getStoredPrompt("client-message")
}

export function saveClientMessagePrompt(prompt: string): Promise<EditablePrompt> {
  return saveStoredPrompt("client-message", prompt)
}
