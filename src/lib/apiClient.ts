import type { ApiEnvelope } from "@/types/api"
import { parseRetryAfter, withRetry } from "@/lib/retry"
import { AUTH_REQUIRED_HEADER, LOGIN_PATH } from "@/constants/auth"

/**
 * Browser → our API routes. Retries follow the HTTP rules for when a repeat is safe:
 * - GET, HEAD, PUT and DELETE are idempotent, so they're retried by default.
 * - POST is retried only when the caller says a repeat is harmless (the generators, which
 *   change nothing), never for the password check or "create", which would double-count or duplicate.
 * Only failures that may clear in a moment are retried: a dropped connection and 408, 429,
 * 502, 503 and 504 answers. A 500 is a real server error (the generators already fell back
 * between AI providers), so it's returned at once. Aborting stops everything.
 */
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "PUT", "DELETE", "OPTIONS"])
const RETRYABLE_STATUS = new Set([408, 429, 502, 503, 504])
const CLIENT_RETRIES = 2

export interface RetryPolicy {
  // Force retries on (a POST that is safe to repeat) or off; defaults to the method's safety
  retry?: boolean
}

// A retryable answer, carried through withRetry so the last one can still be read
class RetryableResponse extends Error {
  constructor(readonly response: Response) {
    super(`Retryable HTTP ${response.status}`)
  }
}

// fetch rejects with a TypeError when the request never got an answer (offline, dropped, DNS)
const isNetworkFailure = (error: unknown) => error instanceof TypeError

/**
 * A session that ended (it expired, or the account signed out elsewhere) sends the person to the
 * sign-in page, which brings them back here afterwards, instead of showing an error on every tool.
 */
function sendToSignIn(response: Response) {
  if (response.status !== 401 || !response.headers.get(AUTH_REQUIRED_HEADER) || typeof window === "undefined") return
  if (window.location.pathname === LOGIN_PATH) return
  const next = `${window.location.pathname}${window.location.search}`
  window.location.assign(`${LOGIN_PATH}?next=${encodeURIComponent(next)}`)
}

export async function fetchWithRetry(url: string, init: RequestInit = {}, { retry }: RetryPolicy = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase()
  const retries = (retry ?? IDEMPOTENT_METHODS.has(method)) ? CLIENT_RETRIES : 0
  try {
    return await withRetry(
      async () => {
        const response = await fetch(url, init)
        sendToSignIn(response)
        if (RETRYABLE_STATUS.has(response.status)) throw new RetryableResponse(response)
        return response
      },
      {
        retries,
        signal: init.signal ?? undefined,
        shouldRetry: (error) => error instanceof RetryableResponse || isNetworkFailure(error),
        retryAfterMs: (error) => (error instanceof RetryableResponse ? parseRetryAfter(error.response.headers.get("retry-after")) : null),
        onRetry: (error, attempt, delayMs) =>
          console.warn(`↻ ${method} ${url} failed (${error instanceof Error ? error.message : error}); retry ${attempt} in ${delayMs}ms`),
      }
    )
  } catch (error: unknown) {
    // Out of retries on a retryable status: hand back the answer so its message can be shown
    if (error instanceof RetryableResponse) return error.response
    throw error
  }
}

/**
 * Calls an internal API route that returns the standard envelope. Resolves with the
 * data and message, or throws an Error carrying the server's user-safe message.
 */
export async function requestApi<T>(url: string, init?: RequestInit, policy?: RetryPolicy): Promise<{ data: T; message?: string }> {
  const response = await fetchWithRetry(url, { cache: "no-store", ...init }, policy)
  let body: ApiEnvelope<T> | null = null
  try {
    body = (await response.json()) as ApiEnvelope<T>
  } catch {
    // Non-JSON response; handled below
  }
  if (!body?.success || body.data === undefined) {
    // The host refuses an oversized body before the route runs, and says so in plain text
    if (!body && response.status === 413) throw new Error("That upload is too large for the server to accept.")
    throw new Error(body?.message || "The server returned an unexpected response.")
  }
  return { data: body.data, message: body.message }
}
