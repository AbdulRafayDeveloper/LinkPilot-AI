import { getStoredPrompt, saveStoredPrompt } from "@/services/promptStore"
import type { EditablePrompt } from "@/types/prompts"

/**
 * Single source of truth for the Trending Topics prompt: its record in the prompts
 * collection ("trending-topics"), with the default text alongside.
 */
export function getActiveTrendingPrompt(): Promise<EditablePrompt> {
  return getStoredPrompt("trending-topics")
}

export function saveTrendingPrompt(prompt: string): Promise<EditablePrompt> {
  return saveStoredPrompt("trending-topics", prompt)
}
