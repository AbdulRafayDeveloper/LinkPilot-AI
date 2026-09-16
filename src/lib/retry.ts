/**
 * Retries with exponential backoff and full jitter, the standard way to retry transient
 * failures without every client hammering a struggling service at the same moment. Works on
 * the server and in the browser. Only errors `shouldRetry` accepts are retried; everything
 * else (and an aborted signal) fails at once, so callers decide what "transient" means.
 */
export interface RetryOptions {
  // Extra attempts after the first one
  retries: number
  shouldRetry: (error: unknown) => boolean
  signal?: AbortSignal
  // Backoff before retry n is a random delay up to min(maxDelayMs, baseDelayMs * 2^n)
  baseDelayMs?: number
  maxDelayMs?: number
  // A wait the failed call asked for (Retry-After); a wait longer than maxDelayMs isn't worth it, so it stops retrying
  retryAfterMs?: (error: unknown) => number | null
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void
}

const DEFAULT_BASE_DELAY_MS = 400
const DEFAULT_MAX_DELAY_MS = 8_000

export function backoffDelay(attempt: number, baseDelayMs = DEFAULT_BASE_DELAY_MS, maxDelayMs = DEFAULT_MAX_DELAY_MS): number {
  return Math.round(Math.random() * Math.min(maxDelayMs, baseDelayMs * 2 ** attempt))
}

// Resolves after `ms`, or rejects as soon as the signal aborts
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

export async function withRetry<T>(operation: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  const { retries, shouldRetry, signal, baseDelayMs, maxDelayMs = DEFAULT_MAX_DELAY_MS, retryAfterMs, onRetry } = options
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation(attempt)
    } catch (error: unknown) {
      if (signal?.aborted || attempt >= retries || !shouldRetry(error)) throw error
      const requested = retryAfterMs?.(error) ?? null
      if (requested !== null && requested > maxDelayMs) throw error
      const delayMs = requested ?? backoffDelay(attempt, baseDelayMs, maxDelayMs)
      onRetry?.(error, attempt + 1, delayMs)
      await sleep(delayMs, signal)
    }
  }
}

// Seconds or an HTTP date, as a Retry-After header gives it
export function parseRetryAfter(value: string | null | undefined): number | null {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(value)
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now())
}
