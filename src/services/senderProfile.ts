import type { PromptName } from "@/services/prompts"
import { getActiveGlobalPrompt } from "@/services/globalPrompts"
import { getStoredPrompt } from "@/services/promptStore"
import type { StoredPrompt } from "@/types/prompts"

/**
 * The user's own "About me" description, shared by every writing tool that needs facts
 * about the sender. Stored like an editable prompt; the default is a fill-in template.
 */
export const SENDER_PROFILE_PROMPT: PromptName = "sender-profile"

/**
 * The sender profile text to give the model, or null while it's still the unfilled
 * template, so tools never present template text as facts about the user.
 */
export function toSenderProfileText(stored: StoredPrompt): string | null {
  return stored.isCustom ? stored.prompt : null
}

/**
 * The user's saved "About me" text, or null when they haven't filled it in yet.
 * Throws UserFacingError when the prompt database is unavailable.
 */
export async function getSenderProfile(): Promise<string | null> {
  return toSenderProfileText(await getStoredPrompt(SENDER_PROFILE_PROMPT))
}

/**
 * Everything the user has written about themselves: the About me profile plus Rafay Profile
 * Info (Global AI Prompts), or null when neither has anything. For tools that need the
 * user's full background, projects and numbers.
 */
export async function getFullSenderProfile(): Promise<string | null> {
  const [aboutMe, rafayProfile] = await Promise.all([getSenderProfile(), getActiveGlobalPrompt("rafay-profile")])
  const parts = [aboutMe?.trim(), rafayProfile.trim()].filter((part): part is string => Boolean(part))
  return parts.join("\n\n") || null
}
