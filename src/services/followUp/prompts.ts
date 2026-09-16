import type { PromptName } from "@/services/prompts"
import { getStoredPrompts, saveStoredPrompt } from "@/services/promptStore"
import { SENDER_PROFILE_PROMPT, toSenderProfileText } from "@/services/senderProfile"
import { LEAD_SIGNALS_PROMPT_ID } from "@/constants/leadSignals"
import { FOLLOW_UP_PROMPT_IDS, type FollowUpPromptId, type FollowUpTypeId } from "@/constants/followUp"
import type { FollowUpPrompt } from "@/types/followUp"

/**
 * Each prompt (Non-Pitch, Pitch, Lead Signals) has its own prompt record, so editing one
 * can never change another.
 */
const promptName = (id: FollowUpPromptId): PromptName => `follow-up-${id}`

export async function getFollowUpPrompts(): Promise<FollowUpPrompt[]> {
  const stored = await getStoredPrompts(FOLLOW_UP_PROMPT_IDS.map(promptName))
  return FOLLOW_UP_PROMPT_IDS.map((id, index) => ({ id, ...stored[index] }))
}

export async function saveFollowUpPrompt(id: FollowUpPromptId, prompt: string): Promise<FollowUpPrompt> {
  return { id, ...(await saveStoredPrompt(promptName(id), prompt)) }
}

export interface FollowUpGenerationInputs {
  typePrompt: string
  signalsPrompt: string
  senderProfile: string | null
}

/**
 * The latest saved prompts for the type and the lead signals, plus About Me, in one query.
 */
export async function getGenerationInputs(type: FollowUpTypeId): Promise<FollowUpGenerationInputs> {
  const [typePrompt, signalsPrompt, senderProfile] = await getStoredPrompts([
    promptName(type),
    promptName(LEAD_SIGNALS_PROMPT_ID),
    SENDER_PROFILE_PROMPT,
  ])
  return {
    typePrompt: typePrompt.prompt,
    signalsPrompt: signalsPrompt.prompt,
    senderProfile: toSenderProfileText(senderProfile),
  }
}
