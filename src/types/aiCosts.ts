/** What the AI calls cost, per model. See constants/aiCosts.ts. */

/** How one model is billed, in US dollars. A model fills only the ones it is billed by; the rest are 0. */
export interface ModelPrices {
  inputPerMillion: number
  outputPerMillion: number
  perAudioMinute: number
  perCall: number
}

/** One model on the Prices tab: its price if it has one, and how much it has been used. */
export interface ModelPriceRow {
  provider: string
  providerLabel: string
  model: string
  prices: ModelPrices | null
  calls: number
  lastUsedAt: string | null
  updatedAt: string | null
  updatedBy: string | null
}

/** What a set of calls used and cost. */
export interface CostTotals {
  calls: number
  inputTokens: number
  outputTokens: number
  audioSeconds: number
  cost: number
  // The part of `cost` worked out at today's price, for calls made before their model had one
  estimatedCost: number
  // Calls on a model with no price at all, which count as nothing
  unpricedCalls: number
}

export interface ModelCost extends CostTotals {
  provider: string
  providerLabel: string
  model: string
  hasPrice: boolean
}

export interface ProviderCost extends CostTotals {
  provider: string
  providerLabel: string
}

export interface ModuleCost extends CostTotals {
  module: string
  title: string
}

export interface KindCost extends CostTotals {
  kind: string
  label: string
}

export interface DayCost extends CostTotals {
  day: string
}

/** The filter choices, read from every call ever recorded, so a new provider or model offers itself. */
export interface CostOptions {
  providers: { id: string; label: string }[]
  models: { provider: string; model: string }[]
  modules: { id: string; label: string }[]
  kinds: { id: string; label: string }[]
}

export interface CostReport {
  totals: CostTotals
  byModel: ModelCost[]
  byProvider: ProviderCost[]
  byModule: ModuleCost[]
  byKind: KindCost[]
  byDay: DayCost[]
  options: CostOptions
}
