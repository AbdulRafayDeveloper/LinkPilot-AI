import type { PromptName } from "@/services/prompts"
import { getStoredPrompt, getStoredPrompts, saveStoredPrompt } from "@/services/promptStore"
import { GLOBAL_PROMPTS, type GlobalPromptId } from "@/constants/globalPrompts"
import type { GlobalPrompt } from "@/types/globalPrompts"

/**
 * Each global prompt has its own prompt record, so editing one can never change another.
 * Every tool's output passes through the Humanization prompt (services/humanizer.ts);
 * Profile Info is part of the sender's facts (services/senderProfile.ts).
 */
const globalPromptName = (id: GlobalPromptId): PromptName => `global-${id}`

/** The latest text of the prompts named, in the order given: every account's or the admin's own. */
export async function getGlobalPrompts(ids: readonly GlobalPromptId[] = GLOBAL_PROMPTS.map((prompt) => prompt.id)): Promise<GlobalPrompt[]> {
  const stored = await getStoredPrompts(ids.map(globalPromptName))
  return ids.map((id, index) => ({ id, ...stored[index] }))
}

export async function getActiveGlobalPrompt(id: GlobalPromptId): Promise<string> {
  const { prompt } = await getStoredPrompt(globalPromptName(id))
  return prompt
}

export async function saveGlobalPrompt(id: GlobalPromptId, prompt: string): Promise<GlobalPrompt> {
  return { id, ...(await saveStoredPrompt(globalPromptName(id), prompt)) }
}
