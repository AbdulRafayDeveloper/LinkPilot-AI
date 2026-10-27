import type { PromptName } from "@/services/prompts"
import { getStoredPrompt } from "@/services/promptStore"
import { getProfileInfo } from "@/services/profileInfo"
import { currentAiRequest } from "@/lib/modelOrder"
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
 * Everything written about the person the result is for: the shared About me profile plus **their
 * own** Profile Info (My AI Profile), or null when neither has anything. Profile Info is read for the
 * account the AI request runs as, so every tool quotes the facts of the person asking and never
 * another account's. For tools that need the user's full background, projects and numbers.
 */
export async function getFullSenderProfile(): Promise<string | null> {
  const [aboutMe, profileInfo] = await Promise.all([getSenderProfile(), getProfileInfo(currentAiRequest().ownerId)])
  const parts = [aboutMe?.trim(), profileInfo?.trim()].filter((part): part is string => Boolean(part))
  return parts.join("\n\n") || null
}
