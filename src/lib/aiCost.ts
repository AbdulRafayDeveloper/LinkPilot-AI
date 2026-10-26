import type { CostTotals, ModelPrices } from "@/types/aiCosts"

/**
 * The arithmetic of what AI calls cost, kept apart from the database so it can be tested on its own.
 * Every amount is US dollars.
 */

export interface UsageAmounts {
  inputTokens: number
  outputTokens: number
  audioSeconds: number
  calls: number
}

export const NO_PRICES: ModelPrices = { inputPerMillion: 0, outputPerMillion: 0, perAudioMinute: 0, perCall: 0 }

// Small enough to keep a fraction of a cent per call, and to stop float dust adding up over thousands
const round = (value: number) => Math.round(value * 1e8) / 1e8

/** What these amounts cost at these prices. */
export function costOf(prices: ModelPrices, usage: UsageAmounts): number {
  return round(
    (usage.inputTokens / 1_000_000) * prices.inputPerMillion +
      (usage.outputTokens / 1_000_000) * prices.outputPerMillion +
      (usage.audioSeconds / 60) * prices.perAudioMinute +
      usage.calls * prices.perCall
  )
}

export const emptyTotals = (): CostTotals => ({
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
  audioSeconds: 0,
  cost: 0,
  estimatedCost: 0,
  unpricedCalls: 0,
})

/** Adds one set of totals into another, in place, and hands it back. */
export function addTotals(into: CostTotals, from: CostTotals): CostTotals {
  into.calls += from.calls
  into.inputTokens += from.inputTokens
  into.outputTokens += from.outputTokens
  into.audioSeconds += from.audioSeconds
  into.cost = round(into.cost + from.cost)
  into.estimatedCost = round(into.estimatedCost + from.estimatedCost)
  into.unpricedCalls += from.unpricedCalls
  return into
}

/**
 * "$12.40", "$0.0042", "$0". A cent is the smallest a bill shows, but a single call usually costs
 * less, so an amount under a cent keeps the digits that say what it is.
 */
export function formatCost(amount: number): string {
  if (amount === 0) return "$0"
  if (amount >= 0.01) return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  // Below a millionth of a dollar the digits stop meaning anything, and toPrecision turns to "1e-7"
  if (amount < 0.000001) return "<$0.000001"
  return `$${amount.toPrecision(2).replace(/0+$/, "")}`
}

/** A provider's own name where the app knows it, otherwise the id it was recorded under. */
export const providerLabelOf = (labels: Record<string, string>, provider: string): string => labels[provider] ?? provider
