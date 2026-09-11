import { loadPrompt } from "@/services/prompts"
import { getStoredPrompt, getStoredPrompts, saveStoredPrompt, type PromptEntry } from "@/services/promptStore"
import { FOLLOW_UP_TYPES, followUpPromptKey, type FollowUpTypeId } from "@/constants/followUp"
import type { FollowUpTypePrompt } from "@/types/followUp"

/**
 * Each follow-up type has its own Setting record and its own default template, so
 * editing the Pitch prompt can never change the Non-Pitch prompt, or the reverse.
 */
function typePromptEntry(type: FollowUpTypeId): PromptEntry {
  return { key: followUpPromptKey(type), defaultPrompt: loadPrompt(`follow-up-${type}`) }
}

export async function getFollowUpPrompts(): Promise<FollowUpTypePrompt[]> {
  const entries = FOLLOW_UP_TYPES.map((type) => ({ type: type.id, entry: typePromptEntry(type.id) }))
  const stored = await getStoredPrompts(entries.map(({ entry }) => entry))
  return entries.map(({ type, entry }, index) => ({ type, ...stored[index], defaultPrompt: entry.defaultPrompt }))
}

export async function getActiveFollowUpPrompt(type: FollowUpTypeId): Promise<string> {
  const { prompt } = await getStoredPrompt(typePromptEntry(type))
  return prompt
}

export async function saveFollowUpPrompt(type: FollowUpTypeId, prompt: string): Promise<FollowUpTypePrompt> {
  const entry = typePromptEntry(type)
  const saved = await saveStoredPrompt(entry, prompt)
  return { type, ...saved, defaultPrompt: entry.defaultPrompt }
}
