import type { AiProviderId } from "@/constants/aiProviders"

/**
 * Which AI provider a response came from. Every AI route attaches it to what it returns
 * (lib/modelOrder.ts), so a page can say "Source: Groq" and usage can be counted per provider.
 * `provider` wrote what is shown (the last answer); `providers` is every provider that answered
 * while making it, which is more than one only when a fallback took over part of the work.
 */
export interface AiSource {
  provider: AiProviderId | null
  providers: AiProviderId[]
}

// On a result type: optional, so results saved before attribution existed still fit
export type WithAiSource = Partial<AiSource>

/** One piece of text an AI provider wrote, with who wrote it. */
export interface AiText {
  text: string
  provider: AiProviderId
}

export type AiUsageKind = "text" | "screenshot" | "web-search" | "speech" | "image"

/** What one successful AI call used, as recorded for budget tracking (services/aiUsage.ts). */
export interface AiUsage {
  provider: AiProviderId
  model: string
  kind: AiUsageKind
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  // Speech only: how long the recording was, when the provider says
  audioSeconds: number | null
  // Groq only: which of GROQ_API_KEY_1..5 answered (1-based)
  keyNumber: number | null
}

export interface AiUsageTotals {
  provider: AiProviderId
  calls: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  audioSeconds: number
  images: number
}

export interface AiUsageSummary {
  days: number
  since: string
  byProvider: AiUsageTotals[]
  byModule: { module: string; title: string; provider: AiProviderId; calls: number; totalTokens: number }[]
}
