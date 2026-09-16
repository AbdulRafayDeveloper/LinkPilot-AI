import type { PromptName } from "@/services/prompts"
import { getStoredPrompt, getStoredPrompts, saveStoredPrompt } from "@/services/promptStore"
import { GLOBAL_PROMPTS, type GlobalPromptId } from "@/constants/globalPrompts"
import type { GlobalPrompt } from "@/types/globalPrompts"

/**
 * Each global prompt has its own prompt record, so editing one can never change another.
 * Every tool's output passes through the Humanization prompt (services/humanizer.ts);
 * Rafay Profile Info is part of the sender's facts (services/senderProfile.ts).
 */
const globalPromptName = (id: GlobalPromptId): PromptName => `global-${id}`

export async function getGlobalPrompts(): Promise<GlobalPrompt[]> {
  const stored = await getStoredPrompts(GLOBAL_PROMPTS.map((prompt) => globalPromptName(prompt.id)))
  return GLOBAL_PROMPTS.map((prompt, index) => ({ id: prompt.id, ...stored[index] }))
}

export async function getActiveGlobalPrompt(id: GlobalPromptId): Promise<string> {
  const { prompt } = await getStoredPrompt(globalPromptName(id))
  return prompt
}

export async function saveGlobalPrompt(id: GlobalPromptId, prompt: string): Promise<GlobalPrompt> {
  return { id, ...(await saveStoredPrompt(globalPromptName(id), prompt)) }
}
