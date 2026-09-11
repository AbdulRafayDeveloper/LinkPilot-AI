import { loadPrompt } from "@/services/prompts"
import { getStoredPrompts, saveStoredPrompt, type PromptEntry } from "@/services/promptStore"
import { GLOBAL_PROMPTS, globalPromptKey, type GlobalPromptId } from "@/constants/globalPrompts"
import type { GlobalPrompt } from "@/types/globalPrompts"

/**
 * Each global prompt has its own Setting record and its own default template, so
 * editing one can never change another. Every tool's output passes through the
 * Humanization prompt (services/humanizer.ts); Rafay Profile Info isn't used yet.
 */
function globalPromptEntry(id: GlobalPromptId): PromptEntry {
  return { key: globalPromptKey(id), defaultPrompt: loadPrompt(`global-${id}`) }
}

export async function getGlobalPrompts(): Promise<GlobalPrompt[]> {
  const entries = GLOBAL_PROMPTS.map((prompt) => ({ id: prompt.id, entry: globalPromptEntry(prompt.id) }))
  const stored = await getStoredPrompts(entries.map(({ entry }) => entry))
  return entries.map(({ id, entry }, index) => ({ id, ...stored[index], defaultPrompt: entry.defaultPrompt }))
}

/**
 * The saved text of one global prompt, or its default template when it was never edited.
 */
export async function getActiveGlobalPrompt(id: GlobalPromptId): Promise<string> {
  const [stored] = await getStoredPrompts([globalPromptEntry(id)])
  return stored.prompt
}

export async function saveGlobalPrompt(id: GlobalPromptId, prompt: string): Promise<GlobalPrompt> {
  const entry = globalPromptEntry(id)
  const saved = await saveStoredPrompt(entry, prompt)
  return { id, ...saved, defaultPrompt: entry.defaultPrompt }
}
