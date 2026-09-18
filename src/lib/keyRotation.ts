/**
 * Several API keys for one provider. A call starts on the key that answered last (the active key) and
 * goes round the list from there: after the last key comes the first again. A key the provider refuses
 * for a reason that belongs to that key (rejected, rate limited, its quota used up) is set aside for a
 * while and the same call goes to the next key; any other failure is the call's own and is thrown at
 * once, because another key would fail the same way. Keys that are resting are tried last rather than
 * skipped, so a call is never refused while a key might still answer.
 */

export interface KeyRotationOptions {
  // Whether this failure belongs to the key (so the next key may succeed)
  isKeyError: (error: unknown) => boolean
  // How long a failed key rests before it is tried again ahead of the others
  restMs: (error: unknown) => number
  // When each key may be tried again, by its index; shared between calls
  resting: Map<number, number>
  // The key to start from: the one that answered last. The keys after it follow, then the ones before it
  start?: number
  signal?: AbortSignal
  now?: () => number
  onSwitch?: (from: number, to: number, error: unknown) => void
  // A key was set aside until the given time (to share it beyond this process)
  onRest?: (index: number, until: number) => void | Promise<void>
  // A key answered, so it is the one to start from next time; `wasResting` when it had been set aside
  onAnswer?: (index: number, wasResting: boolean) => void | Promise<void>
}

/**
 * The order to try the keys in: round the list from `start` (after the last key comes the first), the
 * ones not resting first, then the resting ones, soonest back first.
 */
export function keyOrder(count: number, resting: Map<number, number>, now: number, start = 0): number[] {
  const first = count > 0 && start >= 0 && start < count ? start : 0
  const indexes = Array.from({ length: count }, (_, offset) => (first + offset) % count)
  const ready = indexes.filter((index) => (resting.get(index) ?? 0) <= now)
  const waiting = indexes.filter((index) => (resting.get(index) ?? 0) > now).sort((a, b) => (resting.get(a) ?? 0) - (resting.get(b) ?? 0))
  return [...ready, ...waiting]
}

/**
 * Every key set as `<prefix>1`, `<prefix>2`, `<prefix>3` … however many there are, in number order.
 * A number may be skipped, blank values are ignored, and the same key set twice counts once, so it is
 * never tried twice in one call. `number` is the variable's own number, for logs and usage records.
 */
export function numberedKeys(source: Record<string, string | undefined>, prefix: string): { number: number; value: string }[] {
  const pattern = new RegExp(`^${prefix}(\\d+)$`)
  const seen = new Set<string>()
  return Object.entries(source)
    .map(([name, value]) => ({ number: Number(pattern.exec(name)?.[1] ?? NaN), value: value?.trim() ?? "" }))
    .filter((key) => Number.isInteger(key.number) && key.number > 0 && key.value.length > 0)
    .sort((a, b) => a.number - b.number)
    .filter((key) => !seen.has(key.value) && Boolean(seen.add(key.value)))
}

export async function withKeyRotation<T>(
  keys: readonly string[],
  call: (key: string, index: number) => Promise<T>,
  { isKeyError, restMs, resting, start = 0, signal, now = Date.now, onSwitch, onRest, onAnswer }: KeyRotationOptions
): Promise<T> {
  if (keys.length === 0) throw new Error("KeyRotationException: no keys to try")
  const order = keyOrder(keys.length, resting, now(), start)
  let lastError: unknown
  for (const [position, index] of order.entries()) {
    let result: T
    try {
      result = await call(keys[index], index)
    } catch (error: unknown) {
      if (signal?.aborted || !isKeyError(error)) throw error
      lastError = error
      const until = now() + restMs(error)
      resting.set(index, until)
      await onRest?.(index, until)
      const next = order[position + 1]
      if (next !== undefined) onSwitch?.(index, next, error)
      continue
    }
    const wasResting = resting.delete(index)
    await onAnswer?.(index, wasResting)
    return result
  }
  throw lastError
}
