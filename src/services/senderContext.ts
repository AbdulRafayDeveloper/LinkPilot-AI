import { getSenderProfile } from "@/services/senderProfile"
import { loadPromptBook } from "@/services/promptBook"

export interface UserExperience {
  // The user's own About me profile, or null when it isn't filled in
  text: string | null
  hasProfile: boolean
}

/**
 * The user's trusted experience: their own "About me" profile, the only source of facts
 * about their work, background and results.
 */
export async function findRelevantExperience(): Promise<UserExperience> {
  const profile = (await getSenderProfile())?.trim()
  if (!profile) return { text: null, hasProfile: false }
  return { text: (await loadPromptBook("shared-instructions")).text("sender-context.about-me", { profile }), hasProfile: true }
}
