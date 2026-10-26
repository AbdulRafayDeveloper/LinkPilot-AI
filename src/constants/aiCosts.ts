import type { AiUsageKind } from "@/types/ai"

/**
 * What the AI calls cost, per model (AI Model Priority → Usage & cost, and Prices). Every call is already
 * counted in `ai_usage`; this turns those counts into money with the prices an admin keeps in
 * `model_prices`, one per provider and model. Nothing here names a price or a model in code: a
 * provider or model the app starts using shows up in the filters and the price list by itself.
 */

export const AI_COSTS_ENDPOINT = "/api/admin/ai-costs"
export const AI_PRICES_ENDPOINT = "/api/admin/ai-costs/prices"
// The Usage & cost tab keeps its filters on the account, like every list (constants/savedFilters.ts)
export const AI_COSTS_FILTER_VIEW = "admin-ai-costs"

export const AI_USAGE_KINDS = ["text", "screenshot", "web-search", "speech", "image", "embedding"] as const satisfies readonly AiUsageKind[]
export const AI_KIND_LABELS: Record<AiUsageKind, string> = {
  text: "Writing",
  screenshot: "Screenshots",
  "web-search": "Web search",
  speech: "Speech to text",
  image: "Images",
  embedding: "Embeddings",
}

// A call recorded with no module (outside any tool's request), shown and filtered as one name
export const NO_MODULE = "other"
export const NO_MODULE_LABEL = "Other"

// Every price is US dollars. The ceiling only stops a typing slip (an extra six zeros) being saved
export const PRICE_MAX = 100_000
export const PROVIDER_ID_MAX_LENGTH = 40
export const MODEL_ID_MAX_LENGTH = 120

/** The four ways a model is billed; a model fills only the ones it is billed by. */
export const PRICE_FIELDS = [
  { key: "inputPerMillion", label: "Input", unit: "per 1M tokens" },
  { key: "outputPerMillion", label: "Output", unit: "per 1M tokens" },
  { key: "perAudioMinute", label: "Speech", unit: "per minute" },
  { key: "perCall", label: "Per call", unit: "per call" },
] as const

/**
 * The periods offered, worked out from today each time the popup opens, so "Last 7 days" is always
 * the last seven days rather than the seven days it meant when it was chosen.
 */
export const COST_PERIODS = [
  { id: "all", label: "All time", days: null },
  { id: "today", label: "Today", days: 1 },
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
  { id: "month", label: "This month", days: null },
  { id: "custom", label: "Choose dates", days: null },
] as const
export type CostPeriodId = (typeof COST_PERIODS)[number]["id"]
export const COST_PERIOD_IDS = COST_PERIODS.map((period) => period.id)
export const DEFAULT_COST_PERIOD: CostPeriodId = "all"

export const AI_COST_MESSAGES = {
  loadFailed: "Couldn't load the AI costs. Please try again.",
  pricesFailed: "Couldn't load the prices. Please try again.",
  saveFailed: "Couldn't save that price. Please try again.",
  removeFailed: "Couldn't remove that price. Please try again.",
  badDates: "The start date is after the end date.",
  nothingUsed: "No AI calls match these filters.",
  // Calls made before their model had a price are worked out at the price it has now
  estimated: (amount: string) => `${amount} of this is worked out at today's prices, for calls made before their model had a price.`,
  unpriced: (calls: number) =>
    `${calls.toLocaleString()} ${calls === 1 ? "call is" : "calls are"} on a model with no price yet, so ${calls === 1 ? "it counts" : "they count"} as $0.`,
  setPrices: "Set prices",
  pricesIntro:
    "Prices are in US dollars. Fill only what a model is billed by: most text models by input and output tokens, speech by the minute, images and web searches per call. Each call's cost is saved when it is made, so changing a price later never rewrites the past.",
  groqFree: "Groq's free tier costs nothing: leave Groq at 0, or enter its paid prices to see what the same use would cost.",
  noPrice: "No price yet",
  saved: "Saved",
  addModel: "Add a model",
  addModelHint: "Price a model before it is used, or one from a provider the app has just started using.",
  provider: "Provider",
  model: "Model",
  save: "Save",
  remove: "Remove price",
  badPrice: "Enter a price of 0 or more.",
  needsModel: "Name the provider and the model.",
} as const
