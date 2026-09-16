import type { PromptName } from "@/services/prompts"
import { getStoredPrompt, getStoredPrompts, saveStoredPrompt } from "@/services/promptStore"
import { PROMPT_TARGETS, type PromptTargetId } from "@/constants/promptCreator"
import type { PromptTargetPrompt } from "@/types/promptCreator"

/**
 * Each target (coding agent, AI search) has its own prompt record, so editing one never
 * changes the other.
 */
const targetPromptName = (target: PromptTargetId): PromptName => `prompt-creator-${target}`

export async function getPromptCreatorPrompts(): Promise<PromptTargetPrompt[]> {
  const stored = await getStoredPrompts(PROMPT_TARGETS.map((target) => targetPromptName(target.id)))
  return PROMPT_TARGETS.map((target, index) => ({ target: target.id, ...stored[index] }))
}

export async function getActiveTargetPrompt(target: PromptTargetId): Promise<string> {
  const { prompt } = await getStoredPrompt(targetPromptName(target))
  return prompt
}

export async function saveTargetPrompt(target: PromptTargetId, prompt: string): Promise<PromptTargetPrompt> {
  return { target, ...(await saveStoredPrompt(targetPromptName(target), prompt)) }
}
