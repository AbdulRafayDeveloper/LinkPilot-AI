import { getSenderProfile } from "@/services/senderProfile"

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
  return profile
    ? { text: `About me (written by the user):\n${profile}`, hasProfile: true }
    : { text: null, hasProfile: false }
}
