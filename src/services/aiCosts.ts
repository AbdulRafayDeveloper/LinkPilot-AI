import type { PipelineStage } from "mongoose"
import { connectDatabase } from "@/lib/db"
import { addTotals, costOf, emptyTotals, providerLabelOf, type UsageAmounts } from "@/lib/aiCost"
import { AiUsageModel } from "@/models/AiUsage"
import { ModelPriceModel } from "@/models/ModelPrice"
import { AI_PROVIDER_LABELS } from "@/constants/aiProviders"
import { AI_KIND_LABELS, NO_MODULE, NO_MODULE_LABEL } from "@/constants/aiCosts"
import { APP_TOOLS } from "@/constants/linkedinTools"
import type { Viewer } from "@/types/auth"
import type { CostReport, CostTotals, ModelCost, ModelPriceRow, ModelPrices } from "@/types/aiCosts"

/**
 * What the AI calls cost, per model, from the counts every call already writes to `ai_usage` and
 * the prices an admin keeps in `model_prices`. Admin only, read from AI Model Priority.
 *
 * A call's cost is written as it is made (`priceOfCall`, from services/aiUsage.ts), so a price
 * changed later never rewrites the past. A call saved before its model had a price is worked out
 * here at the price it has now, and that part is reported as estimated; a call whose model has no
 * price at all counts as nothing and is reported as unpriced, so a total is never quietly too low.
 */

const labels: Record<string, string> = AI_PROVIDER_LABELS
const keyOf = (provider: string, model: string) => `${provider}\u0000${model}`
const moduleTitle = (module: string) => (module === NO_MODULE ? NO_MODULE_LABEL : (APP_TOOLS.find((tool) => tool.id === module)?.title ?? module))
const kindLabel = (kind: string) => (AI_KIND_LABELS as Record<string, string>)[kind] ?? kind

const pricesOf = (doc: ModelPrices): ModelPrices => ({
  inputPerMillion: doc.inputPerMillion ?? 0,
  outputPerMillion: doc.outputPerMillion ?? 0,
  perAudioMinute: doc.perAudioMinute ?? 0,
  perCall: doc.perCall ?? 0,
})

// Every call reads a price, so the list (a few dozen rows) is held for a minute per server process
const PRICE_CACHE_MS = 60_000
let cached: { at: number; prices: Map<string, ModelPrices> } | null = null

async function allPrices(): Promise<Map<string, ModelPrices>> {
  if (cached && Date.now() - cached.at < PRICE_CACHE_MS) return cached.prices
  await connectDatabase()
  const docs = await ModelPriceModel.find().lean()
  const prices = new Map(docs.map((doc) => [keyOf(doc.provider, doc.model), pricesOf(doc)]))
  cached = { at: Date.now(), prices }
  return prices
}

/** What one call cost at its model's price now, or null when the model has no price. */
export async function priceOfCall(provider: string, model: string, usage: UsageAmounts): Promise<number | null> {
  const prices = (await allPrices()).get(keyOf(provider, model))
  return prices ? costOf(prices, usage) : null
}

/** Every priced model, and every model that has been used without a price, most used first. */
export async function listModelPrices(): Promise<ModelPriceRow[]> {
  await connectDatabase()
  const [docs, used] = await Promise.all([
    ModelPriceModel.find().lean(),
    AiUsageModel.aggregate<{ _id: { provider: string; model: string }; calls: number; lastUsedAt: Date }>([
      { $group: { _id: { provider: "$provider", model: "$model" }, calls: { $sum: 1 }, lastUsedAt: { $max: "$createdAt" } } },
    ]),
  ])
  const rows = new Map<string, ModelPriceRow>()
  for (const row of used) {
    rows.set(keyOf(row._id.provider, row._id.model), {
      provider: row._id.provider,
      providerLabel: providerLabelOf(labels, row._id.provider),
      model: row._id.model,
      prices: null,
      calls: row.calls,
      lastUsedAt: row.lastUsedAt.toISOString(),
      updatedAt: null,
      updatedBy: null,
    })
  }
  for (const doc of docs) {
    const key = keyOf(doc.provider, doc.model)
    const row = rows.get(key) ?? {
      provider: doc.provider,
      providerLabel: providerLabelOf(labels, doc.provider),
      model: doc.model,
      calls: 0,
      lastUsedAt: null,
    }
    rows.set(key, { ...row, prices: pricesOf(doc), updatedAt: doc.updatedAt.toISOString(), updatedBy: doc.updatedBy })
  }
  return [...rows.values()].sort((one, two) => two.calls - one.calls || one.provider.localeCompare(two.provider) || one.model.localeCompare(two.model))
}

/** Sets one model's prices, from now on. Calls already made keep the cost they were saved with. */
export async function saveModelPrice(viewer: Viewer, input: { provider: string; model: string } & ModelPrices): Promise<void> {
  await connectDatabase()
  const { provider, model, ...prices } = input
  await ModelPriceModel.updateOne({ provider, model }, { $set: { ...prices, updatedBy: viewer.email } }, { upsert: true })
  cached = null
}

/** Takes a model's price off. What its calls already cost stays as it was saved. */
export async function removeModelPrice(provider: string, model: string): Promise<boolean> {
  await connectDatabase()
  const { deletedCount } = await ModelPriceModel.deleteOne({ provider, model })
  cached = null
  return deletedCount > 0
}

export interface CostQuery {
  from: string | null
  to: string | null
  provider: string
  model: string
  module: string
  kind: string
  tz: string
}

interface Bucket {
  _id: { provider: string; model: string; module: string | null; kind: string; day: string }
  calls: number
  inputTokens: number
  outputTokens: number
  audioSeconds: number
  savedCost: number
  // What the calls with no saved cost used, which is worked out at today's price
  openCalls: number
  openInput: number
  openOutput: number
  openAudio: number
}

const sumOf = (field: string) => ({ $sum: { $ifNull: [field, 0] } })
const sumIfOpen = (value: unknown) => ({ $sum: { $cond: [{ $eq: [{ $ifNull: ["$cost", null] }, null] }, value, 0] } })

/**
 * The cost of every call the filters cover, split by model, provider, module, kind and day. One
 * grouped read does all of it, then the prices are applied here, so a filter covers every call
 * rather than one page of them.
 */
export async function costReport(query: CostQuery): Promise<CostReport> {
  await connectDatabase()
  const match: Record<string, unknown> = {}
  if (query.from || query.to) {
    match.createdAt = { ...(query.from ? { $gte: new Date(query.from) } : {}), ...(query.to ? { $lte: new Date(query.to) } : {}) }
  }
  if (query.provider) match.provider = query.provider
  if (query.model) match.model = query.model
  if (query.module) match.module = query.module === NO_MODULE ? null : query.module
  if (query.kind) match.kind = query.kind

  const pipeline: PipelineStage[] = [
    { $match: match },
    {
      $group: {
        _id: {
          provider: "$provider",
          model: "$model",
          module: "$module",
          kind: "$kind",
          day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: query.tz } },
        },
        calls: { $sum: 1 },
        inputTokens: sumOf("$inputTokens"),
        outputTokens: sumOf("$outputTokens"),
        audioSeconds: sumOf("$audioSeconds"),
        savedCost: sumOf("$cost"),
        openCalls: sumIfOpen(1),
        openInput: sumIfOpen({ $ifNull: ["$inputTokens", 0] }),
        openOutput: sumIfOpen({ $ifNull: ["$outputTokens", 0] }),
        openAudio: sumIfOpen({ $ifNull: ["$audioSeconds", 0] }),
      },
    },
  ]

  const [buckets, choices, prices] = await Promise.all([
    AiUsageModel.aggregate<Bucket>(pipeline),
    // The choices come from every call ever made, whatever is filtered, so none can disappear
    AiUsageModel.aggregate<{ _id: { provider: string; model: string; module: string | null; kind: string } }>([
      { $group: { _id: { provider: "$provider", model: "$model", module: "$module", kind: "$kind" } } },
    ]),
    allPrices(),
  ])

  const totals = emptyTotals()
  const byModel = new Map<string, ModelCost>()
  const byProvider = new Map<string, CostTotals & { provider: string }>()
  const byModule = new Map<string, CostTotals>()
  const byKind = new Map<string, CostTotals>()
  const byDay = new Map<string, CostTotals>()
  const into = <T extends CostTotals>(map: Map<string, T>, key: string, fresh: () => T, part: CostTotals) => {
    let row = map.get(key)
    if (!row) {
      row = fresh()
      map.set(key, row)
    }
    addTotals(row, part)
  }

  for (const bucket of buckets) {
    const { provider, model, kind, day } = bucket._id
    const moduleId = bucket._id.module ?? NO_MODULE
    const price = prices.get(keyOf(provider, model))
    const estimated = price
      ? costOf(price, { inputTokens: bucket.openInput, outputTokens: bucket.openOutput, audioSeconds: bucket.openAudio, calls: bucket.openCalls })
      : 0
    const part: CostTotals = {
      calls: bucket.calls,
      inputTokens: bucket.inputTokens,
      outputTokens: bucket.outputTokens,
      audioSeconds: bucket.audioSeconds,
      cost: bucket.savedCost + estimated,
      estimatedCost: estimated,
      unpricedCalls: price ? 0 : bucket.openCalls,
    }
    addTotals(totals, part)
    into(
      byModel,
      keyOf(provider, model),
      () => ({ ...emptyTotals(), provider, providerLabel: providerLabelOf(labels, provider), model, hasPrice: Boolean(price) }),
      part
    )
    into(byProvider, provider, () => ({ ...emptyTotals(), provider }), part)
    into(byModule, moduleId, emptyTotals, part)
    into(byKind, kind, emptyTotals, part)
    into(byDay, day, emptyTotals, part)
  }

  const byCost = <T extends CostTotals>(one: T, two: T) => two.cost - one.cost || two.calls - one.calls
  const distinct = <T>(values: T[]) => [...new Set(values)]
  return {
    totals,
    byModel: [...byModel.values()].sort(byCost),
    byProvider: [...byProvider.values()].map((row) => ({ ...row, providerLabel: providerLabelOf(labels, row.provider) })).sort(byCost),
    byModule: [...byModule.entries()].map(([id, row]) => ({ ...row, module: id, title: moduleTitle(id) })).sort(byCost),
    byKind: [...byKind.entries()].map(([kind, row]) => ({ ...row, kind, label: kindLabel(kind) })).sort(byCost),
    byDay: [...byDay.entries()].map(([day, row]) => ({ ...row, day })).sort((one, two) => two.day.localeCompare(one.day)),
    options: {
      providers: distinct(choices.map((row) => row._id.provider))
        .sort()
        .map((id) => ({ id, label: providerLabelOf(labels, id) })),
      models: distinct(choices.map((row) => keyOf(row._id.provider, row._id.model)))
        .map((key) => {
          const [provider, model] = key.split("\u0000")
          return { provider, model }
        })
        .sort((one, two) => one.provider.localeCompare(two.provider) || one.model.localeCompare(two.model)),
      modules: distinct(choices.map((row) => row._id.module ?? NO_MODULE))
        .map((id) => ({ id, label: moduleTitle(id) }))
        .sort((one, two) => one.label.localeCompare(two.label)),
      kinds: distinct(choices.map((row) => row._id.kind)).map((id) => ({ id, label: kindLabel(id) })),
    },
  }
}
