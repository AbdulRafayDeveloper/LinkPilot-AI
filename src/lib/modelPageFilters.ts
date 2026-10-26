import { matchesWords } from "@/lib/nameSearch"
import type { ModelMapRow, ModelPriorityModule, ModelProviderStatus } from "@/types/modelPriority"
import type { ModelPriceRow } from "@/types/aiCosts"
import type { AiNeed } from "@/constants/modelPriority"

/**
 * What each tab of AI Model Priority is narrowed to, kept apart from the page so the rules are
 * tested on their own. Every filter is "" when it is off, so an empty set shows everything.
 */

/** The "Models in use" tab: which jobs to show. */
export interface ModelMapFilters {
  search: string
  module: string
  job: string
  // The provider that does the job by default
  provider: string
  // "no-model": nothing can do it here; "no-fallback": one model and nothing behind it; "admin-order": admins get a different order
  show: string
}

export const MODEL_MAP_SHOW = [
  { id: "no-model", label: "Nothing can do it" },
  { id: "no-fallback", label: "No fallback" },
  { id: "admin-order", label: "Admins use their own order" },
] as const

export function filterModelMap(rows: readonly ModelMapRow[], filters: ModelMapFilters): ModelMapRow[] {
  return rows.filter((row) => {
    if (filters.module && row.module !== filters.module) return false
    if (filters.job && row.job !== filters.job) return false
    if (filters.provider && row.chain[0]?.provider !== filters.provider) return false
    if (filters.show === "no-model" && row.chain.length > 0) return false
    if (filters.show === "no-fallback" && row.chain.length !== 1) return false
    if (filters.show === "admin-order" && !row.adminChain) return false
    const text = [row.title, row.job, ...row.chain.flatMap((step) => [step.label, step.model])].join(" ")
    return !filters.search.trim() || matchesWords(text, filters.search)
  })
}

/** The "Priority order" tab: which modules to show. */
export interface ModuleOrderFilters {
  search: string
  // "default" or "custom" order
  order: string
  // What the module needs besides writing text, or "text" for one that only writes
  need: string
  // "skipped": a provider is passed over in this module on this deployment
  skipped: string
}

export const ORDER_CHOICES = [
  { id: "default", label: "Default order" },
  { id: "custom", label: "Changed by an admin" },
] as const

export const SKIP_CHOICES = [{ id: "skipped", label: "A provider is skipped" }] as const

/** Whether a provider will be passed over in this module on this deployment, and why. */
export function skipReasonOf(provider: ModelProviderStatus | undefined, need: readonly AiNeed[], labels: Record<AiNeed, string>): string | null {
  if (!provider?.configured) return "Not configured, skipped"
  const missing = need.filter((entry) => !provider.can[entry])
  return missing.length > 0 ? `Skipped for ${missing.map((entry) => labels[entry]).join(" and ")}` : null
}

export function filterModules(
  modules: readonly ModelPriorityModule[],
  providers: readonly ModelProviderStatus[],
  filters: ModuleOrderFilters,
  labels: Record<AiNeed, string>
): ModelPriorityModule[] {
  return modules.filter((module) => {
    if (filters.order === "default" && !module.isDefault) return false
    if (filters.order === "custom" && module.isDefault) return false
    if (filters.need === "text" && module.needs.length > 0) return false
    if (filters.need && filters.need !== "text" && !module.needs.includes(filters.need as AiNeed)) return false
    if (filters.skipped === "skipped") {
      const anySkipped = module.order.some((id) => skipReasonOf(providers.find((provider) => provider.id === id), module.needs, labels))
      if (!anySkipped) return false
    }
    return !filters.search.trim() || matchesWords(module.title, filters.search)
  })
}

/** The "Prices" tab: which models to show. */
export interface PriceFilters {
  search: string
  provider: string
  // "priced" or "unpriced"
  priced: string
}

export const PRICED_CHOICES = [
  { id: "unpriced", label: "No price yet" },
  { id: "priced", label: "Has a price" },
] as const

export function filterPrices(rows: readonly ModelPriceRow[], filters: PriceFilters): ModelPriceRow[] {
  return rows.filter((row) => {
    if (filters.provider && row.provider !== filters.provider) return false
    if (filters.priced === "priced" && !row.prices) return false
    if (filters.priced === "unpriced" && row.prices) return false
    return !filters.search.trim() || matchesWords(`${row.providerLabel} ${row.model}`, filters.search)
  })
}

/** Each distinct value once, in the order first met, as filter choices. */
export function distinctChoices<T>(items: readonly T[], id: (item: T) => string, label: (item: T) => string): { id: string; label: string }[] {
  const seen = new Map<string, string>()
  for (const item of items) if (!seen.has(id(item))) seen.set(id(item), label(item))
  return [...seen.entries()].map(([key, value]) => ({ id: key, label: value }))
}
