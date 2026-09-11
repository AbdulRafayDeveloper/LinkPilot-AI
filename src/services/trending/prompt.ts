import { loadPrompt } from "@/services/prompts"
import { getStoredPrompt, saveStoredPrompt, type PromptEntry } from "@/services/promptStore"
import { TRENDING_PROMPT_SETTING_KEY } from "@/constants/trending"
import type { StoredPrompt } from "@/types/prompts"

export function getDefaultTrendingPrompt(): string {
  return loadPrompt("trending-topics")
}

function trendingPromptEntry(): PromptEntry {
  return { key: TRENDING_PROMPT_SETTING_KEY, defaultPrompt: getDefaultTrendingPrompt() }
}

/**
 * Single source of truth for the Trending Topics prompt: the saved custom prompt when
 * one exists, otherwise the default template in src/prompts/trending-topics.md.
 */
export function getActiveTrendingPrompt(): Promise<StoredPrompt> {
  return getStoredPrompt(trendingPromptEntry())
}

export function saveTrendingPrompt(prompt: string): Promise<StoredPrompt> {
  return saveStoredPrompt(trendingPromptEntry(), prompt)
}
