import { redactSecrets } from "@/lib/providerErrors"

/**
 * What a Gemini answer that failed means, read from its JSON error (`{ error: { code, status,
 * message, details } }`), kept away from the network so the rules are tested on their own.
 *
 * Google answers a bad key with **400** (`API_KEY_INVALID`), not 401, so the usual status rules would
 * read it as the request's own fault and stop at the first key. That is the one thing this file is
 * for: deciding which failures belong to a key, so the same call goes on to the next one.
 */

export type GeminiFailureKind =
  // The key itself was refused: invalid, expired, or the account cannot use the API
  | "rejected"
  // The key's account has used its quota for the day
  | "daily"
  // Too many requests this minute; clears by itself
  | "rate"
  // The model named in GEMINI_EMBEDDING_MODEL does not exist for these keys
  | "model"
  // Anything else: a bad request, or Google's own trouble
  | "other"

export class GeminiError extends Error {
  readonly status: number
  readonly kind: GeminiFailureKind
  // How long Google asked us to wait, when it said
  readonly retryAfterMs: number | null

  constructor(status: number, kind: GeminiFailureKind, message: string, retryAfterMs: number | null) {
    super(redactSecrets(message))
    this.name = "GeminiError"
    this.status = status
    this.kind = kind
    this.retryAfterMs = retryAfterMs
  }
}

interface GeminiErrorDetail {
  "@type"?: string
  reason?: string
  retryDelay?: string
  violations?: { quotaId?: string; quotaMetric?: string }[]
}

interface GeminiErrorBody {
  error?: { code?: number; status?: string; message?: string; details?: GeminiErrorDetail[] }
}

// A key is rested this long when it was refused outright, and this long when its day is used up
// (it is still tried last, so a call is never refused while it might answer)
export const GEMINI_KEY_REJECTED_REST_MS = 10 * 60_000
export const GEMINI_DAILY_LIMIT_REST_MS = 15 * 60_000
export const GEMINI_RATE_LIMIT_REST_MS = 60_000

const secondsOf = (delay: string | undefined): number | null => {
  const match = delay ? /^(\d+(?:\.\d+)?)s$/.exec(delay.trim()) : null
  return match ? Math.ceil(Number(match[1]) * 1000) : null
}

/** The failure a non-2xx Gemini answer stands for. `body` is whatever JSON came back (or null). */
export function geminiFailure(status: number, body: unknown): GeminiError {
  const error = (body && typeof body === "object" ? (body as GeminiErrorBody).error : undefined) ?? {}
  const details = Array.isArray(error.details) ? error.details : []
  const message = error.message?.trim() || `Gemini answered ${status}`
  const reasons = details.map((detail) => detail.reason ?? "").join(" ")
  const quotas = details.flatMap((detail) => detail.violations ?? []).map((violation) => `${violation.quotaId ?? ""} ${violation.quotaMetric ?? ""}`)
  const retryAfterMs = details.map((detail) => secondsOf(detail.retryDelay)).find((value) => value !== null) ?? null

  let kind: GeminiFailureKind = "other"
  if (status === 401 || status === 403 || /API_KEY_INVALID|API_KEY_EXPIRED|API_KEY_SERVICE_BLOCKED/.test(reasons) || /api key (not valid|expired)/i.test(message)) kind = "rejected"
  else if (status === 429) kind = quotas.some((quota) => /PerDay/i.test(quota)) || /per ?day/i.test(message) ? "daily" : "rate"
  else if (status === 404) kind = "model"
  return new GeminiError(status, kind, message, retryAfterMs)
}

/** Whether another key might succeed where this one failed. */
export const isGeminiKeyError = (error: unknown): boolean =>
  error instanceof GeminiError && (error.kind === "rejected" || error.kind === "daily" || error.kind === "rate")

/** How long a key that failed this way sits out before it is tried ahead of the others again. */
export function geminiKeyRestMs(error: unknown): number {
  if (!(error instanceof GeminiError)) return GEMINI_RATE_LIMIT_REST_MS
  if (error.kind === "rejected") return GEMINI_KEY_REJECTED_REST_MS
  if (error.kind === "daily") return GEMINI_DAILY_LIMIT_REST_MS
  return error.retryAfterMs ?? GEMINI_RATE_LIMIT_REST_MS
}

const KIND_SAYS: Record<GeminiFailureKind, (variable: string) => string> = {
  rejected: (variable) => `the key was rejected (check ${variable} where the app runs, including a stray space at its end)`,
  daily: () => "its account has used up today's quota",
  rate: () => "it is at its per-minute limit",
  model: () => "it does not have the model named in GEMINI_EMBEDDING_MODEL",
  other: () => "it failed",
}

/**
 * What to tell the person when every Gemini key failed: one line per key saying what happened to it,
 * so it reads "Key 2: the key was rejected" rather than a bare "please try again".
 */
export function describeGeminiFailures(failures: ReadonlyMap<number, unknown>, totalKeys: number): string {
  const lines = [...failures.entries()]
    .sort(([a], [b]) => a - b)
    .map(([number, error]) => {
      const kind = error instanceof GeminiError ? error.kind : "other"
      return `Key ${number}: ${KIND_SAYS[kind](`GEMINI_API_KEY_${number}`)}.`
    })
  const kinds = new Set([...failures.values()].map((error) => (error instanceof GeminiError ? error.kind : "other")))
  const advice = kinds.size === 1 && kinds.has("daily")
    ? " Every account has used today's quota; it resets tomorrow, or add a key from another Google account."
    : kinds.size === 1 && kinds.has("rate")
      ? " They free up within a minute, so saving again shortly will work."
      : ""
  return `Gemini could not turn your profile into vectors: all ${totalKeys} ${totalKeys === 1 ? "key was" : "keys were"} tried. ${lines.join(" ")}${advice}`
}
