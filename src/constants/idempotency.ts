/**
 * Idempotency keys: how a request that creates something can be retried safely. The browser sends a
 * random key with the request and the same key on every retry of it; the server keeps the first
 * answer under that key and gives it back to any repeat, so a retry after a lost response never
 * saves a second copy or pays for a second AI call.
 */
export const IDEMPOTENCY_HEADER = "Idempotency-Key"
// Set on an answer the server gave back from an earlier attempt instead of running the request again
export const IDEMPOTENT_REPLAY_HEADER = "Idempotent-Replayed"
// A UUID, or any similar random token; long enough that it can't be guessed
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/

export const IDEMPOTENCY_MESSAGES = {
  badKey: "That request carried an unreadable idempotency key.",
  stillRunning: "This request is still being processed. Please wait a moment.",
  alreadyDone: "This was already saved. Reload the page to see it.",
} as const
