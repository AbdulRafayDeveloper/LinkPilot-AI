import { AsyncLocalStorage } from "node:async_hooks"
import { DEFAULT_MODEL_ORDER, type AiProviderId } from "@/constants/aiProviders"
import type { UserRole } from "@/constants/auth"
import { ModelOrderSchema } from "@/lib/validation/modelPriority"
import type { AiSource } from "@/types/ai"

/**
 * The AI request being handled. A route resolves the provider order once, for the module and the
 * account asking (services/modelPriority.ts), and runs its work inside withModelOrder; every AI call
 * made during that work, however deep (humanizing, lead signals, research, rewrites), reads the order
 * here instead of each function passing it down, and notes here which provider answered it. That
 * note is what the route attaches to the response (currentSource) and what usage is recorded against
 * (services/aiUsage.ts), so a module or a provider added later is attributed without extra code.
 * Outside a request the order is the default and nothing is noted.
 */
interface AiRequest {
  order: readonly AiProviderId[]
  // The tool id the request belongs to (constants/linkedinTools.ts)
  module: string | null
  ownerId: string | null
  // Every provider that answered a call, in the order the calls finished
  answered: AiProviderId[]
}

const currentRequest = new AsyncLocalStorage<AiRequest>()

export function withModelOrder<T>(order: readonly AiProviderId[], run: () => T, details: { module?: string; ownerId?: string } = {}): T {
  return currentRequest.run({ order, module: details.module ?? null, ownerId: details.ownerId ?? null, answered: [] }, run)
}

export function currentModelOrder(): readonly AiProviderId[] {
  return currentRequest.getStore()?.order ?? DEFAULT_MODEL_ORDER
}

/** The module and account the running AI request belongs to, for usage records. */
export function currentAiRequest(): { module: string | null; ownerId: string | null } {
  const request = currentRequest.getStore()
  return { module: request?.module ?? null, ownerId: request?.ownerId ?? null }
}

/** Notes that a provider answered one call in the running request. */
export function noteProviderAnswered(provider: AiProviderId): void {
  currentRequest.getStore()?.answered.push(provider)
}

/**
 * Who a set of answers came from: `provider` is the provider of the last answer (the one that wrote
 * what is shown, since rewriting and humanizing come last), `providers` every provider that answered,
 * each once in order of first use. Null and empty when nothing answered.
 */
export function sourceFrom(answered: readonly AiProviderId[]): AiSource {
  return { provider: answered.at(-1) ?? null, providers: [...new Set(answered)] }
}

/** The source of the running request so far. */
export function currentSource(): AiSource {
  return sourceFrom(currentRequest.getStore()?.answered ?? [])
}

/**
 * The order an account gets for a module: an admin gets the order saved for it, a regular user always
 * the default. A saved order that no longer lists every provider exactly once is ignored.
 */
export function resolveModelOrder(role: UserRole, saved: readonly unknown[] | null | undefined): readonly AiProviderId[] {
  if (role !== "admin" || !saved) return DEFAULT_MODEL_ORDER
  const parsed = ModelOrderSchema.safeParse(saved)
  return parsed.success ? parsed.data : DEFAULT_MODEL_ORDER
}
