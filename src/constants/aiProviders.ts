/**
 * The AI providers, in the order every module tries them unless an admin changed it for that module
 * (services/modelPriority.ts): Groq first, with up to five keys; then an open-source model on any
 * OpenAI-compatible server, for when every Groq key is used up; then OpenAI. A provider that isn't
 * configured, or can't do what the call needs (search the web, read a screenshot, read speech), is
 * skipped. The server decides which ones are configured (services/ai.ts); these are only the ids and
 * the names a page shows.
 */
export const MODEL_PROVIDERS = ["groq", "open-source", "openai"] as const
export type AiProviderId = (typeof MODEL_PROVIDERS)[number]

// What a regular user always gets, and what an admin gets until they change a module's order
export const DEFAULT_MODEL_ORDER: readonly AiProviderId[] = MODEL_PROVIDERS

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = { groq: "Groq", "open-source": "Open-source model", openai: "OpenAI" }

const isProviderId = (value: string): value is AiProviderId => value in AI_PROVIDER_LABELS

/**
 * The providers that did a job, named for the page: the first provider in the order by its name,
 * any other as the backup. ["groq"] reads "Groq"; ["openai"] after Groq reads "OpenAI (backup)".
 */
export function describeProviders(used: readonly string[], order: readonly AiProviderId[] = DEFAULT_MODEL_ORDER): string {
  return used
    .filter(isProviderId)
    .map((provider) => (provider === order[0] ? AI_PROVIDER_LABELS[provider] : `${AI_PROVIDER_LABELS[provider]} (backup)`))
    .join(" and ")
}

/**
 * What a page shows for where an AI result came from: "Source: Groq", or "Source: OpenAI (Groq also
 * answered)" when a fallback wrote part of it. Null when there is no known provider to name.
 */
export function describeSource(source: { provider?: string | null; providers?: readonly string[] } | null | undefined): string | null {
  const provider = source?.provider
  if (!provider || !isProviderId(provider)) return null
  const others = (source?.providers ?? []).filter((entry): entry is AiProviderId => entry !== provider && isProviderId(entry))
  const also = others.length > 0 ? ` (${others.map((entry) => AI_PROVIDER_LABELS[entry]).join(" and ")} also answered)` : ""
  return `Source: ${AI_PROVIDER_LABELS[provider]}${also}`
}

