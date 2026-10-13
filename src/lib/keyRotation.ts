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
 * Which key a call starts on when **several calls are running at once**.
 *
 * One call at a time starts on the active key, which is the documented behaviour: the key that
 * answered last is the one to use. Calls that overlap are the problem this solves. They used to all
 * start on that same key, so three calls in parallel spent one key's per-minute allowance three
 * times over, rested it, moved to the next key together, and burned every key in seconds — which is
 * exactly how a meeting's analysis (three parts at a time) could fail outright while each key was
 * perfectly healthy on its own.
 *
 * Each call in flight is therefore given the next key along as its starting point. The keys come
 * from different accounts, each with its own allowance, so three parallel calls use three accounts
 * instead of hammering one. Everything else is unchanged: a call still walks the whole list from
 * wherever it starts, so no key is ever skipped.
 */
export const startKeyFor = (active: number, inFlight: number, count: number): number =>
  count > 0 ? (Math.max(0, active) + Math.max(0, inFlight)) % count : 0


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
