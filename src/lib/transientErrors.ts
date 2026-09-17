/**
 * Server side: whether a failed outbound call (AI provider, web research, MongoDB) is worth
 * retrying. Transient means it may well succeed in a moment: rate limits, 5xx answers and
 * dropped connections. Bad requests, bad keys, used-up quotas, timeouts and aborts are not
 * retried; for AI calls the next provider takes over instead, which is faster than waiting.
 */
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])
const NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
])
const NETWORK_MESSAGE = /fetch failed|socket hang up|network error|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i
const DATABASE_NETWORK_ERROR = /^(?:MongoNetworkError|MongoNetworkTimeoutError|MongoServerSelectionError|MongooseServerSelectionError)$/
// A 429 that means the plan's quota is used up won't clear in seconds
const QUOTA_EXHAUSTED = /exceeded your current quota|insufficient_quota|billing|per day|\(TPD\)|\(RPD\)/i
// Status codes the SDKs only put in the message, e.g. "[503 Service Unavailable]"
const STATUS_IN_MESSAGE = /\[(\d{3})\b|\b(\d{3}) (?:Service Unavailable|Bad Gateway|Gateway Timeout|Too Many Requests|Internal Server Error|Request Timeout)\b/i

interface ErrorLike {
  name?: unknown
  message?: unknown
  status?: unknown
  statusCode?: unknown
  code?: unknown
  response?: { status?: unknown; headers?: unknown }
  headers?: unknown
  cause?: unknown
}

const asErrorLike = (error: unknown): ErrorLike => (typeof error === "object" && error !== null ? (error as ErrorLike) : {})
const messageOf = (error: unknown) => String(asErrorLike(error).message ?? "")

function statusOf(error: unknown): number | null {
  const candidate = asErrorLike(error)
  for (const value of [candidate.status, candidate.statusCode, candidate.response?.status]) {
    if (typeof value === "number") return value
  }
  const match = messageOf(error).match(STATUS_IN_MESSAGE)
  return match ? Number(match[1] ?? match[2]) : null
}

function networkCodeOf(error: unknown): string | null {
  const candidate = asErrorLike(error)
  const code = candidate.code ?? asErrorLike(candidate.cause).code
  return typeof code === "string" ? code : null
}

export function isTransientError(error: unknown): boolean {
  const name = String(asErrorLike(error).name ?? "")
  if (name === "AbortError" || name === "TimeoutError") return false
  if (DATABASE_NETWORK_ERROR.test(name)) return true
  const status = statusOf(error)
  if (status !== null) return RETRYABLE_STATUS.has(status) && !(status === 429 && QUOTA_EXHAUSTED.test(messageOf(error)))
  const code = networkCodeOf(error)
  if (code) return NETWORK_CODES.has(code)
  return NETWORK_MESSAGE.test(messageOf(error)) || NETWORK_MESSAGE.test(messageOf(asErrorLike(error).cause))
}

function headerOf(headers: unknown, name: string): string | null {
  if (!headers || typeof headers !== "object") return null
  if (typeof (headers as Headers).get === "function") return (headers as Headers).get(name)
  const value = (headers as Record<string, unknown>)[name]
  return typeof value === "string" ? value : null
}

/**
 * The wait a rate-limited provider asked for, in ms: a Retry-After header (OpenAI, Groq) or a delay
 * written into the error's message ("Please try again in 7.5s"). Null when it gave none.
 */
export function retryAfterOf(error: unknown): number | null {
  const candidate = asErrorLike(error)
  const header = headerOf(candidate.headers, "retry-after") ?? headerOf(candidate.response?.headers, "retry-after")
  if (header) {
    const seconds = Number(header)
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  }
  const delay = messageOf(error).match(/retry(?:Delay|[ -]after|[ -]in)["':\s]*([\d.]+)\s*s/i)
  return delay ? Number(delay[1]) * 1000 : null
}
