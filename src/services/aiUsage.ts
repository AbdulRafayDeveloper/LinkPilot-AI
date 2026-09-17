import { connectDatabase } from "@/lib/db"
import { currentAiRequest, noteProviderAnswered } from "@/lib/modelOrder"
import { readTokenUsage } from "@/lib/aiUsage"
import { AiUsageModel } from "@/models/AiUsage"
import { AI_PROVIDER_LABELS, MODEL_PROVIDERS, type AiProviderId } from "@/constants/aiProviders"
import { APP_TOOLS } from "@/constants/linkedinTools"
import type { AiUsage, AiUsageKind, AiUsageSummary, AiUsageTotals } from "@/types/ai"

/**
 * Budget tracking. Every successful AI call reports here what answered it and what it used; the call
 * is noted on the running request (so the response can say "Source: Groq") and written to `ai_usage`
 * with the module and account it belonged to. Recording can never fail or slow the call it describes
 * beyond one small insert, and nothing the user wrote or the model answered is kept.
 */

export interface UsageReport {
  provider: AiProviderId
  model: string
  kind: AiUsageKind
  // Whatever the SDK put on its answer (lib/aiUsage.ts reads every shape)
  usage?: unknown
  keyNumber?: number | null
  audioSeconds?: number | null
}

export async function recordAiUsage({ provider, model, kind, usage, keyNumber = null, audioSeconds = null }: UsageReport): Promise<AiUsage> {
  noteProviderAnswered(provider)
  const counts = readTokenUsage(usage)
  const entry: AiUsage = { provider, model, kind, ...counts, audioSeconds: audioSeconds ?? counts.audioSeconds, keyNumber }
  const { module, ownerId } = currentAiRequest()
  console.info("🧾 AI usage", { provider, model, kind, module, totalTokens: entry.totalTokens, audioSeconds: entry.audioSeconds, keyNumber })
  try {
    await connectDatabase()
    await AiUsageModel.create({ ...entry, module, ownerId })
  } catch (error: unknown) {
    console.warn("⚠️ AI usage was not recorded:", error instanceof Error ? error.message : error)
  }
  return entry
}

const toolTitle = (module: string) => APP_TOOLS.find((tool) => tool.id === module)?.title ?? module

/** What each provider used over the last `days`, and what each module used of each provider. */
export async function summarizeAiUsage(days: number): Promise<AiUsageSummary> {
  await connectDatabase()
  const since = new Date(Date.now() - days * 86_400_000)
  const [providers, modules] = await Promise.all([
    AiUsageModel.aggregate<{ _id: string; calls: number; inputTokens: number; outputTokens: number; totalTokens: number; audioSeconds: number; images: number }>([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: "$provider",
          calls: { $sum: 1 },
          inputTokens: { $sum: { $ifNull: ["$inputTokens", 0] } },
          outputTokens: { $sum: { $ifNull: ["$outputTokens", 0] } },
          totalTokens: { $sum: { $ifNull: ["$totalTokens", 0] } },
          audioSeconds: { $sum: { $ifNull: ["$audioSeconds", 0] } },
          images: { $sum: { $cond: [{ $eq: ["$kind", "image"] }, 1, 0] } },
        },
      },
    ]),
    AiUsageModel.aggregate<{ _id: { module: string | null; provider: string }; calls: number; totalTokens: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { module: "$module", provider: "$provider" }, calls: { $sum: 1 }, totalTokens: { $sum: { $ifNull: ["$totalTokens", 0] } } } },
      { $sort: { totalTokens: -1 } },
    ]),
  ])
  const isProvider = (value: string): value is AiProviderId => value in AI_PROVIDER_LABELS
  const byProvider: AiUsageTotals[] = MODEL_PROVIDERS.map((provider) => {
    const row = providers.find((entry) => entry._id === provider)
    return {
      provider,
      calls: row?.calls ?? 0,
      inputTokens: row?.inputTokens ?? 0,
      outputTokens: row?.outputTokens ?? 0,
      totalTokens: row?.totalTokens ?? 0,
      audioSeconds: Math.round(row?.audioSeconds ?? 0),
      images: row?.images ?? 0,
    }
  })
  return {
    days,
    since: since.toISOString(),
    byProvider,
    byModule: modules
      .filter((row) => isProvider(row._id.provider))
      .map((row) => ({
        module: row._id.module ?? "other",
        title: row._id.module ? toolTitle(row._id.module) : "Other",
        provider: row._id.provider as AiProviderId,
        calls: row.calls,
        totalTokens: row.totalTokens,
      })),
  }
}
