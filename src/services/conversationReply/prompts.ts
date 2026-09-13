import { loadPrompt } from "@/services/prompts"
import { getStoredPrompts, saveStoredPrompt, type PromptEntry } from "@/services/promptStore"
import { senderProfileEntry } from "@/services/senderProfile"
import { LEAD_SIGNALS_PROMPT_ID } from "@/constants/leadSignals"
import {
  ABOUT_ME_TAB_ID,
  CONVERSATION_REPLY_PROMPT_IDS,
  conversationReplyPromptKey,
  type ConversationReplyPromptId,
  type ConversationReplyTypeId,
} from "@/constants/conversationReply"
import type { ConversationReplyPrompt } from "@/types/conversationReply"

/**
 * Each tone, and this tool's Lead Signals prompt, has its own Setting record and default
 * template, so editing one never changes another (or Follow-Up's Lead Signals prompt).
 * "About me" maps to the shared sender profile.
 */
function promptEntry(id: ConversationReplyPromptId): PromptEntry {
  return id === ABOUT_ME_TAB_ID
    ? senderProfileEntry()
    : { key: conversationReplyPromptKey(id), defaultPrompt: loadPrompt(`conversation-reply-${id}`) }
}

export async function getConversationReplyPrompts(): Promise<ConversationReplyPrompt[]> {
  const entries = CONVERSATION_REPLY_PROMPT_IDS.map((id) => ({ id, entry: promptEntry(id) }))
  const stored = await getStoredPrompts(entries.map(({ entry }) => entry))
  return entries.map(({ id, entry }, index) => ({ id, ...stored[index], defaultPrompt: entry.defaultPrompt }))
}

export async function saveConversationReplyPrompt(
  id: ConversationReplyPromptId,
  prompt: string
): Promise<ConversationReplyPrompt> {
  const entry = promptEntry(id)
  const saved = await saveStoredPrompt(entry, prompt)
  return { id, ...saved, defaultPrompt: entry.defaultPrompt }
}

/**
 * The latest saved prompts for the tone and the Lead Signals, read fresh for every generation.
 */
export async function getGenerationPrompts(
  type: ConversationReplyTypeId
): Promise<{ typePrompt: string; signalsPrompt: string }> {
  const [typePrompt, signalsPrompt] = await getStoredPrompts([promptEntry(type), promptEntry(LEAD_SIGNALS_PROMPT_ID)])
  return { typePrompt: typePrompt.prompt, signalsPrompt: signalsPrompt.prompt }
}
