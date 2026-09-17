/**
 * Several API keys for one provider, tried in order. A key the provider refuses for a reason that
 * belongs to that key (rejected, rate limited, its quota used up) is set aside for a while and the
 * same call goes to the next key; any other failure is the call's own and is thrown at once, because
 * another key would fail the same way. Keys that are resting are tried last rather than skipped, so a
 * call is never refused while a key might still answer.
 */

export interface KeyRotationOptions {
  // Whether this failure belongs to the key (so the next key may succeed)
  isKeyError: (error: unknown) => boolean
  // How long a failed key rests before it is tried first again
  restMs: (error: unknown) => number
  // When each key may be tried first again, by its index; shared between calls
  resting: Map<number, number>
  signal?: AbortSignal
  now?: () => number
  onSwitch?: (from: number, to: number, error: unknown) => void
}

/** The order to try the keys in: the ones not resting first, then the resting ones, soonest back first. */
export function keyOrder(count: number, resting: Map<number, number>, now: number): number[] {
  const indexes = Array.from({ length: count }, (_, index) => index)
  const ready = indexes.filter((index) => (resting.get(index) ?? 0) <= now)
  const waiting = indexes.filter((index) => (resting.get(index) ?? 0) > now).sort((a, b) => (resting.get(a) ?? 0) - (resting.get(b) ?? 0))
  return [...ready, ...waiting]
}

export async function withKeyRotation<T>(
  keys: readonly string[],
  call: (key: string, index: number) => Promise<T>,
  { isKeyError, restMs, resting, signal, now = Date.now, onSwitch }: KeyRotationOptions
): Promise<T> {
  if (keys.length === 0) throw new Error("KeyRotationException: no keys to try")
  const order = keyOrder(keys.length, resting, now())
  let lastError: unknown
  for (const [position, index] of order.entries()) {
    try {
      const result = await call(keys[index], index)
      resting.delete(index)
      return result
    } catch (error: unknown) {
      if (signal?.aborted || !isKeyError(error)) throw error
      lastError = error
      resting.set(index, now() + restMs(error))
      const next = order[position + 1]
      if (next !== undefined) onSwitch?.(index, next, error)
    }
  }
  throw lastError
}
