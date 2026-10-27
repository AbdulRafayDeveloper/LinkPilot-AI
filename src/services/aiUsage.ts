import { connectDatabase } from "@/lib/db"
import { currentAiRequest, noteProviderAnswered } from "@/lib/modelOrder"
import { readTokenUsage } from "@/lib/aiUsage"
import { AiUsageModel } from "@/models/AiUsage"
import { priceOfCall } from "@/services/aiCosts"
import { isModelProvider, type UsageProviderId } from "@/constants/aiProviders"
import type { AiUsage, AiUsageKind } from "@/types/ai"

/**
 * Budget tracking. Every successful AI call reports here what answered it and what it used; the call
 * is noted on the running request (so the response can say "Source: Groq") and written to `ai_usage`
 * with the module and account it belonged to. Recording can never fail or slow the call it describes
 * beyond one small insert, and nothing the user wrote or the model answered is kept.
 *
 * What the call cost is saved with it, at the price its model has now (services/aiCosts.ts), so the
 * cost report reads what was really spent even after a price changes. A model with no price saves
 * no cost, and the report works it out later or says it has none.
 */

export interface UsageReport {
  provider: UsageProviderId
  model: string
  kind: AiUsageKind
  // Whatever the SDK put on its answer (lib/aiUsage.ts reads every shape)
  usage?: unknown
  keyNumber?: number | null
  audioSeconds?: number | null
}

export async function recordAiUsage({ provider, model, kind, usage, keyNumber = null, audioSeconds = null }: UsageReport): Promise<AiUsage> {
  // Only a provider that writes is named as a result's source; an embedding is counted, not credited
  if (isModelProvider(provider)) noteProviderAnswered(provider)
  const counts = readTokenUsage(usage)
  const entry: AiUsage = { provider, model, kind, ...counts, audioSeconds: audioSeconds ?? counts.audioSeconds, keyNumber }
  const { module, ownerId } = currentAiRequest()
  console.info("🧾 AI usage", { provider, model, kind, module, totalTokens: entry.totalTokens, audioSeconds: entry.audioSeconds, keyNumber })
  try {
    await connectDatabase()
    const cost = await priceOfCall(provider, model, {
      inputTokens: entry.inputTokens ?? 0,
      outputTokens: entry.outputTokens ?? 0,
      audioSeconds: entry.audioSeconds ?? 0,
      calls: 1,
    })
    await AiUsageModel.create({ ...entry, module, ownerId, cost })
  } catch (error: unknown) {
    console.warn("⚠️ AI usage was not recorded:", error instanceof Error ? error.message : error)
  }
  return entry
}
