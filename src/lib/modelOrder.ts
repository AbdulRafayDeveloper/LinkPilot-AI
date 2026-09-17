import { AsyncLocalStorage } from "node:async_hooks"
import { DEFAULT_MODEL_ORDER, type AiProviderId } from "@/constants/aiProviders"
import type { UserRole } from "@/constants/auth"
import { ModelOrderSchema } from "@/lib/validation/modelPriority"

/**
 * The provider order for the request being handled. A route resolves it once, for the module and the
 * account asking (services/modelPriority.ts), and runs its work inside withModelOrder; every AI call
 * made during that work, however deep (humanizing, lead signals, research, rewrites), reads it here
 * instead of each function passing it down. Outside a request it is the default order.
 */
const requestOrder = new AsyncLocalStorage<readonly AiProviderId[]>()

export function withModelOrder<T>(order: readonly AiProviderId[], run: () => T): T {
  return requestOrder.run(order, run)
}

export function currentModelOrder(): readonly AiProviderId[] {
  return requestOrder.getStore() ?? DEFAULT_MODEL_ORDER
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
