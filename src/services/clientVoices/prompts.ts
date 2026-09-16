import { getStoredPrompt, saveStoredPrompt } from "@/services/promptStore"
import type { ClientVoicesPrompt } from "@/types/clientVoices"

/**
 * The module's one editable prompt: how the client's own words become a list of the work they
 * asked for. Every batch goes through it, with the transcripts placed inside it.
 */
export function getClientVoicesPrompt(): Promise<ClientVoicesPrompt> {
  return getStoredPrompt("client-voice-tasks")
}

export function saveClientVoicesPrompt(prompt: string): Promise<ClientVoicesPrompt> {
  return saveStoredPrompt("client-voice-tasks", prompt)
}
