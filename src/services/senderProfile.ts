import { loadPrompt } from "@/services/prompts"
import { getStoredPrompt, type PromptEntry } from "@/services/promptStore"
import type { StoredPrompt } from "@/types/prompts"

export const SENDER_PROFILE_SETTING_KEY = "sender_profile"

/**
 * The user's own "About me" description, shared by every writing tool that needs facts
 * about the sender. Stored like an editable prompt; the default is a fill-in template.
 */
export function senderProfileEntry(): PromptEntry {
  return { key: SENDER_PROFILE_SETTING_KEY, defaultPrompt: loadPrompt("sender-profile") }
}

/**
 * The sender profile text to give the model, or null while it's still the unfilled
 * template, so tools never present template text as facts about the user.
 */
export function toSenderProfileText(stored: StoredPrompt): string | null {
  return stored.isCustom ? stored.prompt : null
}

/**
 * The user's saved "About me" text, or null when they haven't filled it in yet.
 * Throws UserFacingError when the settings database is unavailable.
 */
export async function getSenderProfile(): Promise<string | null> {
  return toSenderProfileText(await getStoredPrompt(senderProfileEntry()))
}
