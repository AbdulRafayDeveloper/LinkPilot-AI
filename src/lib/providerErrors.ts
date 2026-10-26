/**
 * Saying what an AI provider actually refused.
 *
 * A failed generation used to reach the user as "please try again", which is the same sentence
 * whether a key is missing, a model name is wrong, a quota is used up or the provider was simply
 * busy. On a deployed app that is the difference between a five minute fix and an afternoon, so
 * every failure is turned into a sentence that names the thing to go and change.
 *
 * Nothing a provider says is passed through as it is. A key or token that appears in an error is
 * redacted first, and only the short reason is kept, so a message shown in the browser can never
 * carry a secret.
 */

// What a provider's SDK puts on an error, without depending on any one SDK's types
interface ProviderErrorShape {
  status?: number
  code?: string
  error?: { status?: number; code?: string; message?: string; type?: string }
  response?: { status?: number }
  message?: string
  name?: string
}

/** Anything that looks like a credential is never repeated back, whatever the provider sent. */
export function redactSecrets(text: string): string {
  return text
    .replace(/\b(?:sk|rk)-[A-Za-z0-9_-]{8,}/g, "[key]")
    .replace(/\bAIza[0-9A-Za-z_-]{10,}/g, "[key]")
    .replace(/\bgsk_[A-Za-z0-9]{10,}/g, "[key]")
    .replace(/\bBearer\s+[A-Za-z0-9._-]{8,}/gi, "Bearer [key]")
    .replace(/([?&](?:key|api_key|access_token)=)[^&\s]+/gi, "$1[key]")
}

const shapeOf = (error: unknown): ProviderErrorShape => (error && typeof error === "object" ? (error as ProviderErrorShape) : {})

/** The HTTP status the provider answered with, wherever its SDK happened to put it. */
export function providerStatus(error: unknown): number | null {
  const shape = shapeOf(error)
  const status = shape.status ?? shape.error?.status ?? shape.response?.status
  if (typeof status === "number") return status
  // Some SDKs only put the status in the message, e.g. "[401 Unauthorized] API key not valid"
  const fromMessage = typeof shape.message === "string" ? shape.message.match(/\b(4\d{2}|5\d{2})\b/) : null
  return fromMessage ? Number(fromMessage[1]) : null
}

const messageOf = (error: unknown): string => {
  const shape = shapeOf(error)
  const raw = shape.error?.message ?? shape.message ?? String(error)
  return redactSecrets(raw).replace(/\s+/g, " ").trim()
}

// The first sentence is the useful part; the rest is usually a stack or a link to the docs
const firstSentence = (text: string, max = 160) => {
  const sentence = text.split(/(?<=[.!?])\s/)[0] ?? text
  return sentence.length > max ? `${sentence.slice(0, max).trim()}...` : sentence
}

export interface ProviderNames {
  // What to call the provider in a sentence, e.g. "Groq"
  label: string
  keyVariable: string
  modelVariable: string
}

/**
 * One provider's failure, in words that say what to change. The environment variable is named
 * because that is the thing the user has to go and fix, on their own machine or on the host.
 */
export function describeProviderFailure(error: unknown, { label, keyVariable, modelVariable }: ProviderNames): string {
  const status = providerStatus(error)
  const message = messageOf(error)
  const lower = message.toLowerCase()

  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return `${label} took too long to answer and the request was stopped.`
  }
  if (error instanceof RequestTooLargeError) {
    return `${label} cannot take a request this long: it is about ${error.inputTokens.toLocaleString("en-US")} tokens, and each key may use ${error.limit.toLocaleString("en-US")} a minute. Paste less text, such as the profile without its activity and posts.`
  }
  if (status === 401 || status === 403 || /api key not valid|invalid[_ ]api[_ ]key|unauthorized|permission denied/.test(lower)) {
    return `${label} rejected the API key. Check ${keyVariable} where the app is deployed, including a stray space or a newline at the end of it.`
  }
  if (status === 404 || /model not found|does not exist|is not found for api version|unknown model/.test(lower)) {
    return `${label} does not have the model named in ${modelVariable}, or this key cannot use it. Check that value.`
  }
  if (PER_DAY_LIMIT.test(message)) {
    return `${label} has used up its daily token limit on every key. It frees up again over the next hour, or add a key from another ${label} account.`
  }
  if (status === 413 && TOKEN_RATE_LIMIT.test(message)) {
    return `${label} cannot take a request this long within its per-minute token limit. Paste less text.`
  }
  // Groq ends every limit message with a link to its billing page, which says nothing about this key
  if (/quota|billing|insufficient[_ ]quota|exceeded your current quota/.test(lower.replace(/https?:\/\/\S+/g, ""))) {
    return `${label} says this key is out of quota or has no billing set up. Check the account behind ${keyVariable}.`
  }
  if (status === 429) {
    return `${label} is rate limiting this key right now. Wait a moment and try again.`
  }
  if (status !== null && status >= 500) {
    return `${label} had a problem on its side (${status}). Try again in a moment.`
  }
  if (status === 400 && /safety|blocked|content/.test(lower)) {
    return `${label} refused this request because of its own content rules.`
  }
  // Nothing recognised: the provider's own first sentence is more use than "please try again"
  return `${label} failed${status ? ` (${status})` : ""}. ${firstSentence(message)}`.trim()
}

// A per-minute token ceiling Groq answers with 413 rather than 429 ("Request too large ... tokens per minute")
const TOKEN_RATE_LIMIT = /rate_limit_exceeded|tokens per minute|\((?:TPM|OTPM)\)/i
const PER_DAY_LIMIT = /per day|\((?:TPD|RPD)\)/i
const KEY_REJECTED_REST_MS = 10 * 60_000
const DAILY_LIMIT_REST_MS = 15 * 60_000
const RATE_LIMIT_REST_MS = 60_000

/**
 * Whether a failure belongs to the API key rather than the request, so the same call may well succeed
 * with another key: the key was rejected (401, 403), rate limited or out of quota (429), or the
 * request ran into the key's per-minute token ceiling (Groq's 413).
 */
export function isKeyLimitError(error: unknown): boolean {
  const status = providerStatus(error)
  if (status === 401 || status === 403 || status === 429) return true
  return status === 413 && TOKEN_RATE_LIMIT.test(messageOf(error))
}

/**
 * Whether the provider said this is the **day's** limit rather than the minute's. A per-minute
 * ceiling clears by itself in a moment, so the work can simply carry on; a daily one does not, and
 * the user has to be told rather than left watching a page that will never finish.
 */
export function isDailyLimit(error: unknown): boolean {
  return PER_DAY_LIMIT.test(messageOf(error))
}

/**
 * The per-minute token ceiling a request ran into, from Groq's 413 ("Request too large ... (TPM): Limit
 * 8000, Requested 11293"). Groq counts a request as its input **plus the room asked for the answer**, so
 * when the room asked for is known, `requested - room` is the exact size of the input.
 */
export interface TokenCeiling {
  limit: number
  requested: number
}

const REQUEST_TOO_LARGE = /Limit (\d+), Requested (\d+)/i

export function tokenCeilingOf(error: unknown): TokenCeiling | null {
  if (providerStatus(error) !== 413) return null
  const match = messageOf(error).match(REQUEST_TOO_LARGE)
  return match ? { limit: Number(match[1]), requested: Number(match[2]) } : null
}

/**
 * The answer room that brings a request under its ceiling, or null when even `min` would not fit, so
 * the input itself is too long. Always less than what was asked for, so fitting again can never loop.
 */
export function fitAnswerTokens(ceiling: TokenCeiling, askedFor: number, { min, margin }: { min: number; margin: number }): number | null {
  const inputTokens = ceiling.requested - askedFor
  const room = Math.min(ceiling.limit - inputTokens - margin, askedFor - 1)
  return room >= min ? room : null
}

/**
 * Whether the model failed to deliver the JSON it was asked for (Groq's `json_validate_failed`): it
 * used the whole of its answer room before closing the JSON ("max completion tokens reached before
 * generating a valid document"), or handed back nothing that could be read at all. A reasoning model
 * does both when it thinks for too long, so asking it to think less is what helps.
 */
const WROTE_NO_JSON = /json_validate_failed|failed to (?:validate|generate) json/i

export function wroteNoJson(error: unknown): boolean {
  return providerStatus(error) === 400 && WROTE_NO_JSON.test(messageOf(error))
}

// Groq's refusal of a reasoning setting the model does not have
const NO_REASONING_SETTING = /reasoning_effort/i

export function refusedReasoningSetting(error: unknown): boolean {
  return providerStatus(error) === 400 && NO_REASONING_SETTING.test(messageOf(error))
}

/**
 * A request whose input alone leaves no room for an answer under the provider's per-minute ceiling.
 * It belongs to the request, not the key: every key has the same ceiling, so trying the next one
 * would only fail again, and the next provider is given the work instead.
 */
export class RequestTooLargeError extends Error {
  constructor(
    readonly inputTokens: number,
    readonly limit: number
  ) {
    super(`Request too large: about ${inputTokens} tokens of input against a per-minute ceiling of ${limit}`)
    this.name = "RequestTooLargeError"
  }
}

/** How long a key that failed that way is tried last: a rejected key for a while, a rate limit for as long as asked. */
export function keyRestMs(error: unknown, retryAfterMs: number | null): number {
  const status = providerStatus(error)
  if (status === 401 || status === 403) return KEY_REJECTED_REST_MS
  if (PER_DAY_LIMIT.test(messageOf(error))) return DAILY_LIMIT_REST_MS
  return retryAfterMs ?? RATE_LIMIT_REST_MS
}
