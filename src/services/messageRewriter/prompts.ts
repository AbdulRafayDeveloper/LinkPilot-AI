import { getStoredPrompt, saveStoredPrompt } from "@/services/promptStore"
import type { MessageRewriterPrompt } from "@/types/messageRewriter"

/**
 * The module's one overall prompt: how a message in any language becomes a short, clear
 * English one. Every message goes through it, with the original placed inside it.
 */
export function getMessageRewriterPrompt(): Promise<MessageRewriterPrompt> {
  return getStoredPrompt("message-rewriter")
}

export function saveMessageRewriterPrompt(prompt: string): Promise<MessageRewriterPrompt> {
  return saveStoredPrompt("message-rewriter", prompt)
}
