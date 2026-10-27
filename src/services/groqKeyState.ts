import { GROQ_API_KEYS } from "@/config/env"
import { createProviderKeyState } from "@/services/providerKeyState"

/**
 * The one shared answer to "which Groq key do we use now", for every module and every server instance
 * (services/providerKeyState.ts holds the rules, shared with Gemini's keys).
 *
 * Every Groq call starts on the key **after** the one that answered last and goes round from there,
 * so the work is spread over the accounts a key at a time rather than one account being drained of
 * its minute's tokens; keys that are resting are still tried last, so keys 1 to 3 being used up never
 * costs a call anything.
 */
const groqKeys = createProviderKeyState("groq", "Groq", GROQ_API_KEYS)

/** Where a Groq call starts, and which keys are resting: read from the shared state when it is stale. */
export const groqKeyPlan = groqKeys.plan

/** A key was refused for a reason of its own: every instance sets it aside until `until`. */
export const noteGroqKeyResting = groqKeys.noteResting

/** A key answered. When it is not already the active one, it becomes the key every call starts from. */
export const noteGroqKeyAnswered = groqKeys.noteAnswered

/**
 * The number of the key the next call starts on (GROQ_API_KEY_<n>), for the status page; null with
 * no keys. It is the key after the one that answered last, which is where a call really begins.
 */
export const activeGroqKeyNumber = groqKeys.activeKeyNumber
