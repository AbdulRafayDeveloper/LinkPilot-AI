import { HumanMessage } from "@langchain/core/messages"
import { loadPromptBook } from "@/services/promptBook"
import {
  generateStructuredWithFallback,
  type StructuredGeneration,
  type StructuredGenerationOptions,
} from "@/services/ai"

// First-person claims about the sender, which are fabrications when there is no sender profile.
// ("caught my interest" is an expression, not a claim, so only "my interest in <topic>" counts.)
const SENDER_CLAIM =
  /\b(?:I|I'm|I am|I've|I have)\s+(?:(?:also|do|really|actually|currently|mainly|primarily)\s+)?(?:specialize|specialise|specializing|help|helping|build|built|building|work|worked|working|focus|focused|run|lead|offer|provide|create|develop|design|spent|been)\b|\bmy\s+(?:own\s+)?(?:background|experience|expertise|work|focus|company|business|team|services?|product|agency|clients|specialty|role|skills|journey)\b|\bmy\s+interests?\s+in\s+(?!your\b|how\b|what\b|the way\b)|\b(?:our|we)\s+(?:both|shared|share|have a lot)\b|\bsimilar to (?:mine|my)\b|\blike (?:me|mine)\b/i

export function containsSenderClaim(text: string): boolean {
  return SENDER_CLAIM.test(text)
}

interface SenderGuardOptions<T extends Record<string, unknown>> extends StructuredGenerationOptions<T> {
  senderProfile: string | null
  // The user-visible text to scan for sender claims, e.g. subject plus message
  claimText: (output: T) => string
  // The draft as shown to the model when it is asked to rewrite
  describeDraft: (output: T) => string
}

export interface GuardedGeneration<T> extends StructuredGeneration<T> {
  senderClaimRewrite: boolean
  unsupportedSenderClaim: boolean
}

/**
 * Structured generation (the module's provider order, Groq first) that, when there is no sender
 * profile, checks the output for invented claims about the sender and runs one
 * controlled rewrite. A claim that survives the rewrite is reported, not hidden.
 */
export async function generateWithoutSenderClaims<T extends Record<string, unknown>>({
  senderProfile,
  claimText,
  describeDraft,
  ...generation
}: SenderGuardOptions<T>): Promise<GuardedGeneration<T>> {
  const first = await generateStructuredWithFallback(generation)
  if (senderProfile !== null || !containsSenderClaim(claimText(first.data))) {
    return { ...first, senderClaimRewrite: false, unsupportedSenderClaim: false }
  }

  const rewrite = await generateStructuredWithFallback({
    ...generation,
    messages: [
      ...generation.messages,
      new HumanMessage((await loadPromptBook("shared-instructions")).text("guard.rewrite", { draft: describeDraft(first.data) })),
    ],
  }).catch((error: unknown) => {
    if (generation.signal?.aborted) throw error
    console.warn("⚠️ Sender-claim rewrite failed; returning the draft with a warning:", error)
    return null
  })

  if (!rewrite) return { ...first, senderClaimRewrite: false, unsupportedSenderClaim: true }
  return { ...rewrite, senderClaimRewrite: true, unsupportedSenderClaim: containsSenderClaim(claimText(rewrite.data)) }
}
