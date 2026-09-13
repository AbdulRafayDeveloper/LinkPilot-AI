import { loadPrompt } from "@/services/prompts"
import { getStoredPrompts, saveStoredPrompt, type PromptEntry } from "@/services/promptStore"
import { senderProfileEntry, toSenderProfileText } from "@/services/senderProfile"
import { LEAD_SIGNALS_PROMPT_ID } from "@/constants/leadSignals"
import {
  FOLLOW_UP_PROMPT_IDS,
  followUpPromptKey,
  type FollowUpPromptId,
  type FollowUpTypeId,
} from "@/constants/followUp"
import type { FollowUpPrompt } from "@/types/followUp"

/**
 * Each prompt (Non-Pitch, Pitch, Lead Signals) has its own Setting record and its own
 * default template, so editing one can never change another.
 */
function promptEntry(id: FollowUpPromptId): PromptEntry {
  return { key: followUpPromptKey(id), defaultPrompt: loadPrompt(`follow-up-${id}`) }
}

export async function getFollowUpPrompts(): Promise<FollowUpPrompt[]> {
  const entries = FOLLOW_UP_PROMPT_IDS.map((id) => ({ id, entry: promptEntry(id) }))
  const stored = await getStoredPrompts(entries.map(({ entry }) => entry))
  return entries.map(({ id, entry }, index) => ({ id, ...stored[index], defaultPrompt: entry.defaultPrompt }))
}

export async function saveFollowUpPrompt(id: FollowUpPromptId, prompt: string): Promise<FollowUpPrompt> {
  const entry = promptEntry(id)
  const saved = await saveStoredPrompt(entry, prompt)
  return { id, ...saved, defaultPrompt: entry.defaultPrompt }
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
    promptEntry(type),
    promptEntry(LEAD_SIGNALS_PROMPT_ID),
    senderProfileEntry(),
  ])
  return {
    typePrompt: typePrompt.prompt,
    signalsPrompt: signalsPrompt.prompt,
    senderProfile: toSenderProfileText(senderProfile),
  }
}
