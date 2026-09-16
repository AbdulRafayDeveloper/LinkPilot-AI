import OpenAI, { toFile } from "openai"
import { ChatOpenAI } from "@langchain/openai"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import type { BaseMessage } from "@langchain/core/messages"
import type { InteropZodType } from "@langchain/core/utils/types"
import { env } from "@/config/env"
import { UserFacingError } from "@/lib/errors"
import { withRetry } from "@/lib/retry"
import { isTransientError, retryAfterOf } from "@/lib/transientErrors"

/**
 * The only AI providers the LinkedIn tools use, in priority order: Gemini is primary,
 * OpenAI is the fallback. Model names come exclusively from ENV (src/config/env.ts).
 */
export const AI_PROVIDERS = ["gemini", "openai"] as const
export type ModelProvider = (typeof AI_PROVIDERS)[number]

export interface ModelOptions {
  temperature?: number
  timeout?: number
  maxRetries?: number
}

const DEFAULT_TEMPERATURE = 0.1

interface ProviderSettings {
  apiKey: string | undefined
  model: string | undefined
  keyVariable: string
  modelVariable: string
}

function providerSettings(provider: ModelProvider): ProviderSettings {
  return provider === "gemini"
    ? {
        apiKey: env.GOOGLE_API_KEY,
        model: env.GEMINI_LIGHTWEIGHT_MODEL,
        keyVariable: "GOOGLE_API_KEY",
        modelVariable: "GEMINI_LIGHTWEIGHT_MODEL",
      }
    : {
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_LIGHTWEIGHT_MODEL,
        keyVariable: "OPENAI_API_KEY",
        modelVariable: "OPENAI_LIGHTWEIGHT_MODEL",
      }
}

/**
 * A provider is usable only when both its API key and its model name are set in ENV.
 */
export function isProviderConfigured(provider: ModelProvider): boolean {
  const { apiKey, model } = providerSettings(provider)
  return Boolean(apiKey && model)
}

function requireProvider(provider: ModelProvider): { apiKey: string; model: string } {
  const { apiKey, model, keyVariable, modelVariable } = providerSettings(provider)
  if (!apiKey || !model) {
    const missing = [!apiKey && keyVariable, !model && modelVariable].filter(Boolean).join(" and ")
    throw new UserFacingError(`The ${provider} provider isn't configured. Set ${missing} in .env.local.`)
  }
  return { apiKey, model }
}

/**
 * The Gemini chat model from ENV. Gemini has no client timeout option; pass an AbortSignal to bound a call.
 */
export function createGeminiModel(options: Omit<ModelOptions, "timeout"> = {}): ChatGoogleGenerativeAI {
  const { apiKey, model } = requireProvider("gemini")
  return new ChatGoogleGenerativeAI({ apiKey, model, temperature: DEFAULT_TEMPERATURE, ...options })
}

/**
 * Whether OpenAI can read recordings: its API key and a transcription model are both set in ENV.
 */
export function isTranscriptionConfigured(): boolean {
  return Boolean(env.OPENAI_API_KEY && env.OPENAI_TRANSCRIPTION_MODEL)
}

// File extension per container, because the transcription API decides the format from the name
const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/flac": "flac",
}

/**
 * Writes out a recording with OpenAI's transcription model from ENV (OPENAI_TRANSCRIPTION_MODEL).
 * This is the fallback for audio, which the chat models in this file cannot read: it goes to
 * OpenAI's own transcription endpoint, retried on transient failures like every other call.
 */
export async function transcribeWithOpenAI(
  audio: { data: Buffer; mimeType: string },
  signal: AbortSignal
): Promise<string> {
  const apiKey = env.OPENAI_API_KEY
  const model = env.OPENAI_TRANSCRIPTION_MODEL
  if (!apiKey || !model) {
    const missing = [!apiKey && "OPENAI_API_KEY", !model && "OPENAI_TRANSCRIPTION_MODEL"].filter(Boolean).join(" and ")
    throw new UserFacingError(`Reading recordings needs ${missing} in .env.local.`)
  }

  const client = new OpenAI({ apiKey, maxRetries: 0 })
  const file = await toFile(audio.data, `recording.${AUDIO_EXTENSIONS[audio.mimeType] ?? "webm"}`, { type: audio.mimeType })
  // response_format "text" answers with the transcript itself, which every model supports
  const text = await withProviderRetry(
    "openai",
    () => client.audio.transcriptions.create({ file, model, response_format: "text" }, { signal }),
    signal
  )
  return String(text)
}

/**
 * The OpenAI fallback chat model from ENV (GPT-4o Mini).
 */
export function createOpenAIModel(options: ModelOptions = {}): ChatOpenAI {
  const { apiKey, model } = requireProvider("openai")
  return new ChatOpenAI({ apiKey, model, temperature: DEFAULT_TEMPERATURE, ...options })
}

const DEFAULT_GENERATION_TIMEOUT_MS = 45_000
// Transient failures (rate limit, 5xx, dropped connection) are retried on the same provider this many
// times, with backoff, before the next provider takes over. LangChain's own blind retries are switched
// off (maxRetries: 0) so the two never stack.
const PROVIDER_RETRIES = 2

/**
 * Retries one provider call on transient failures only (lib/transientErrors.ts), honoring a
 * Retry-After the provider sends. Shared by generation and live research.
 */
export function withProviderRetry<T>(provider: ModelProvider, call: () => Promise<T>, signal: AbortSignal, retries = PROVIDER_RETRIES): Promise<T> {
  return withRetry(call, {
    retries,
    signal,
    shouldRetry: isTransientError,
    retryAfterMs: retryAfterOf,
    onRetry: (error, attempt, delayMs) =>
      console.warn(`↻ ${provider} call failed (${error instanceof Error ? error.message : error}); retry ${attempt} of ${retries} in ${delayMs}ms`),
  })
}

export interface StructuredGenerationOptions<T extends Record<string, unknown>> {
  schema: InteropZodType<T>
  name: string
  messages: BaseMessage[]
  temperature?: number
  timeoutMs?: number
  signal?: AbortSignal
  // Subset of AI_PROVIDERS to try, in order; defaults to Gemini first, OpenAI fallback
  providers?: readonly ModelProvider[]
  // Called when one provider fails and the next is about to be tried
  onFallback?: (failed: ModelProvider, next: ModelProvider) => void
  // Returns a reason when the output is unusable, which triggers the fallback provider
  validate?: (output: T) => string | null
}

export interface StructuredGeneration<T> {
  data: T
  provider: ModelProvider
}

function invokeStructured<T extends Record<string, unknown>>(
  provider: ModelProvider,
  { schema, name, messages, temperature = DEFAULT_TEMPERATURE }: StructuredGenerationOptions<T>,
  signal: AbortSignal
): Promise<T> {
  const modelOptions = { temperature, maxRetries: 0 }
  if (provider === "gemini") {
    return createGeminiModel(modelOptions).withStructuredOutput(schema, { name }).invoke(messages, { signal })
  }
  return createOpenAIModel(modelOptions).withStructuredOutput(schema, { name, strict: true }).invoke(messages, { signal })
}

/**
 * The single generation path for every LinkedIn tool: LangChain structured output with
 * Gemini first and OpenAI (GPT-4o Mini) only as the fallback. A transient failure is retried
 * on the same provider first (withProviderRetry); the fallback runs only when Gemini is
 * unconfigured, keeps failing, fails for good (bad key, used-up quota), times out or returns
 * output that fails validation, so a successful request never calls both providers. The
 * timeout covers every attempt on one provider.
 */
export async function generateStructuredWithFallback<T extends Record<string, unknown>>(
  options: StructuredGenerationOptions<T>
): Promise<StructuredGeneration<T>> {
  const providers = (options.providers ?? AI_PROVIDERS).filter(isProviderConfigured)
  if (providers.length === 0) {
    throw new UserFacingError(
      "No AI provider is configured. Set GOOGLE_API_KEY and GEMINI_LIGHTWEIGHT_MODEL, or OPENAI_API_KEY and OPENAI_LIGHTWEIGHT_MODEL, in .env.local."
    )
  }

  let lastError: unknown
  for (const [index, provider] of providers.entries()) {
    const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_GENERATION_TIMEOUT_MS)
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
    try {
      const data = await withProviderRetry(provider, () => invokeStructured(provider, options, signal), signal)
      const problem = options.validate?.(data) ?? null
      if (problem) throw new Error(`UnusableOutputException: ${problem}`)
      return { data, provider }
    } catch (error: unknown) {
      if (options.signal?.aborted) throw error
      lastError = error
      const next = providers[index + 1]
      console.warn(
        `⚠️ ${provider} generation failed${next ? `, falling back to ${next}` : ""}:`,
        error instanceof Error ? error.message : error
      )
      if (next) options.onFallback?.(provider, next)
    }
  }
  throw lastError
}
