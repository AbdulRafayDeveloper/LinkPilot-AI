import type { PromptName } from "@/services/prompts"
import { getStoredPrompts, saveStoredPrompt } from "@/services/promptStore"
import { SENDER_PROFILE_PROMPT } from "@/services/senderProfile"
import { LEAD_SIGNALS_PROMPT_ID } from "@/constants/leadSignals"
import {
  ABOUT_ME_TAB_ID,
  CONVERSATION_REPLY_PROMPT_IDS,
  type ConversationReplyPromptId,
  type ConversationReplyTypeId,
} from "@/constants/conversationReply"
import type { ConversationReplyPrompt } from "@/types/conversationReply"

/**
 * Each tone, and this tool's Lead Signals prompt, has its own prompt record, so editing one
 * never changes another (or Follow-Up's Lead Signals prompt). "About me" maps to the shared
 * sender profile.
 */
const promptName = (id: ConversationReplyPromptId): PromptName =>
  id === ABOUT_ME_TAB_ID ? SENDER_PROFILE_PROMPT : `conversation-reply-${id}`

export async function getConversationReplyPrompts(): Promise<ConversationReplyPrompt[]> {
  const stored = await getStoredPrompts(CONVERSATION_REPLY_PROMPT_IDS.map(promptName))
  return CONVERSATION_REPLY_PROMPT_IDS.map((id, index) => ({ id, ...stored[index] }))
}

export async function saveConversationReplyPrompt(
  id: ConversationReplyPromptId,
  prompt: string
): Promise<ConversationReplyPrompt> {
  return { id, ...(await saveStoredPrompt(promptName(id), prompt)) }
}

/**
 * The latest saved prompts for the tone and the Lead Signals, read fresh for every generation.
 */
export async function getGenerationPrompts(
  type: ConversationReplyTypeId
): Promise<{ typePrompt: string; signalsPrompt: string }> {
  const [typePrompt, signalsPrompt] = await getStoredPrompts([promptName(type), promptName(LEAD_SIGNALS_PROMPT_ID)])
  return { typePrompt: typePrompt.prompt, signalsPrompt: signalsPrompt.prompt }
}
