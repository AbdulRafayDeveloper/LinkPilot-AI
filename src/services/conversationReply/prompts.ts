import { loadPrompt } from "@/services/prompts"
import { getStoredPrompt, getStoredPrompts, saveStoredPrompt, type PromptEntry } from "@/services/promptStore"
import { senderProfileEntry } from "@/services/senderProfile"
import {
  ABOUT_ME_TAB_ID,
  CONVERSATION_REPLY_PROMPT_IDS,
  conversationReplyPromptKey,
  type ConversationReplyPromptId,
  type ConversationReplyTypeId,
} from "@/constants/conversationReply"
import type { ConversationReplyPrompt } from "@/types/conversationReply"

/**
 * Each reply type has its own Setting record and default template, so editing one
 * type's prompt can never change another's. "About me" maps to the shared sender profile.
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
 * The latest saved prompt for the reply type, read fresh for every generation.
 */
export async function getActiveReplyTypePrompt(type: ConversationReplyTypeId): Promise<string> {
  const { prompt } = await getStoredPrompt(promptEntry(type))
  return prompt
}
