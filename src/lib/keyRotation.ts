/**
 * Several API keys for one provider. A call starts on the key **after** the one that answered last
 * and goes round the list from there: after the last key comes the first again. A key the provider refuses
 * for a reason that belongs to that key (rejected, rate limited, its quota used up) is set aside for a
 * while and the same call goes to the next key; any other failure is the call's own and is thrown at
 * once, because another key would fail the same way. Keys that are resting are tried last rather than
 * skipped, so a call is never refused while a key might still answer.
 */

import { sleep } from "./retry"

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
  /**
   * How long the call may wait for a key whose rest is nearly over, when **every** key refused it.
   * A per-minute token limit clears in seconds and the provider says when ("try again in 3.345s"),
   * so waiting it out keeps the work with the provider the user chose rather than handing it to the
   * fallback. Left out, the call fails as soon as every key has been tried, exactly as before.
   */
  maxWaitMs?: number
  // Told which key the call is waiting for and for how long, so the wait is never silent
  onWait?: (index: number, waitMs: number) => void
}

/**
 * Which key a call starts on: the one **after** the key that answered last, and one further along
 * again for each call already running.
 *
 * Every call used to start on the key that answered last. That is the wrong way round for a
 * **per-minute token allowance**: a Groq key holds 8,000 tokens a minute, and one Comment Writer
 * comment costs two calls of 3,000 to 4,800 tokens each, so the second call on that same key left
 * no room and the third was refused. Measured on the live site: the Value Add tune was answered by
 * OpenAI on two runs in three, with all seven keys reporting "tokens per minute (TPM): Limit 8000"
 * within the same second, each from its own organization.
 *
 * Going round instead leaves each account a minute to recover while the other six are used, so the
 * same keys carry several times the work before anything is refused, and calls that overlap still
 * start on different keys. Nothing else changes: a call walks the whole list from wherever it
 * starts (`keyOrder`), and resting keys are still tried last, so a rejected or used-up key is never
 * the one a call waits on.
 */
export const startKeyFor = (active: number, inFlight: number, count: number): number =>
  count > 0 ? (Math.max(0, active) + 1 + Math.max(0, inFlight)) % count : 0


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

/** The key whose rest ends first, or null when none of them is resting. */
function nextFreeKey(count: number, resting: Map<number, number>): number | null {
  let soonest: number | null = null
  for (let index = 0; index < count; index++) {
    const until = resting.get(index)
    if (until === undefined) continue
    if (soonest === null || until < (resting.get(soonest) ?? 0)) soonest = index
  }
  return soonest
}

export async function withKeyRotation<T>(
  keys: readonly string[],
  call: (key: string, index: number) => Promise<T>,
  { isKeyError, restMs, resting, start = 0, signal, now = Date.now, onSwitch, onRest, onAnswer, maxWaitMs = 0, onWait }: KeyRotationOptions
): Promise<T> {
  if (keys.length === 0) throw new Error("KeyRotationException: no keys to try")
  let lastError: unknown
  let hasWaited = false
  for (;;) {
    const order = keyOrder(keys.length, resting, now(), start)
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
    /**
     * Every key refused this call. When the first of them is free again within the wait the caller
     * allows, the call waits instead of failing: a per-minute limit is a few seconds, and the
     * provider the user chose writing the answer a moment later beats the fallback writing it now.
     * Only ever one wait, so a provider that is really out of room still gives way quickly.
     */
    const soonest = nextFreeKey(keys.length, resting)
    const waitMs = soonest === null ? Number.POSITIVE_INFINITY : (resting.get(soonest) ?? 0) - now()
    if (hasWaited || soonest === null || waitMs > maxWaitMs) throw lastError
    hasWaited = true
    if (waitMs > 0) {
      onWait?.(soonest, waitMs)
      await sleep(waitMs, signal)
    }
  }
}
