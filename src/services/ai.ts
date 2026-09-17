import OpenAI, { toFile } from "openai"
import Groq, { toFile as toGroqFile } from "groq-sdk"
import { ChatOpenAI } from "@langchain/openai"
import { ChatGroq } from "@langchain/groq"
import type { BaseMessage } from "@langchain/core/messages"
import type { InteropZodType } from "@langchain/core/utils/types"
import { env, GROQ_API_KEYS } from "@/config/env"
import { UserFacingError } from "@/lib/errors"
import { describeProviderFailure, isKeyLimitError, keyRestMs, type ProviderNames } from "@/lib/providerErrors"
import { withKeyRotation } from "@/lib/keyRotation"
import { currentModelOrder } from "@/lib/modelOrder"
import { withRetry } from "@/lib/retry"
import { isTransientError, retryAfterOf } from "@/lib/transientErrors"
import { AI_PROVIDER_LABELS, MODEL_PROVIDERS, type AiProviderId } from "@/constants/aiProviders"

/**
 * Every provider the app can call, in the default order: Groq, then an open-source model on an
 * OpenAI-compatible server, then OpenAI. A module's order comes from the request (lib/modelOrder.ts),
 * which is this default for everyone unless an admin changed it for that module. Model names come
 * exclusively from ENV (src/config/env.ts).
 */
export const AI_PROVIDERS = MODEL_PROVIDERS
export type ModelProvider = AiProviderId

// What a call hands the model: plain text, or a screenshot as well (only vision models can read those)
export type ModelInput = "text" | "image"

export interface ModelOptions {
  temperature?: number
  timeout?: number
  maxRetries?: number
}

const DEFAULT_TEMPERATURE = 0.1
const GROQ_KEY_VARIABLES = "GROQ_API_KEY_1 to GROQ_API_KEY_5"

interface ProviderSettings {
  // What the provider needs before it can be called, by variable name, and whether each is set
  required: { variable: string; isSet: boolean }[]
  keyVariable: string
  modelVariable: string
}

function providerSettings(provider: ModelProvider, input: ModelInput = "text"): ProviderSettings {
  switch (provider) {
    case "groq": {
      const modelVariable = input === "image" ? "GROQ_VISION_MODEL" : "GROQ_MODEL"
      const model = input === "image" ? env.GROQ_VISION_MODEL : env.GROQ_MODEL
      return {
        required: [
          { variable: GROQ_KEY_VARIABLES, isSet: GROQ_API_KEYS.length > 0 },
          { variable: modelVariable, isSet: Boolean(model) },
        ],
        keyVariable: GROQ_KEY_VARIABLES,
        modelVariable,
      }
    }
    case "open-source":
      return {
        required: [
          { variable: "OPEN_SOURCE_BASE_URL", isSet: Boolean(env.OPEN_SOURCE_BASE_URL) },
          { variable: "OPEN_SOURCE_MODEL", isSet: Boolean(env.OPEN_SOURCE_MODEL) },
        ],
        keyVariable: "OPEN_SOURCE_API_KEY",
        modelVariable: "OPEN_SOURCE_MODEL",
      }
    case "openai":
      return {
        required: [
          { variable: "OPENAI_API_KEY", isSet: Boolean(env.OPENAI_API_KEY) },
          { variable: "OPENAI_LIGHTWEIGHT_MODEL", isSet: Boolean(env.OPENAI_LIGHTWEIGHT_MODEL) },
        ],
        keyVariable: "OPENAI_API_KEY",
        modelVariable: "OPENAI_LIGHTWEIGHT_MODEL",
      }
  }
}

/** What a provider is called, and which variables carry its key and its model name. */
export function providerNames(provider: ModelProvider, input: ModelInput = "text"): ProviderNames {
  const { keyVariable, modelVariable } = providerSettings(provider, input)
  return { label: AI_PROVIDER_LABELS[provider], keyVariable, modelVariable }
}

/**
 * A provider is usable only when everything it needs is set in ENV. The open-source model reads text
 * only, so a screenshot always skips it.
 */
export function isProviderConfigured(provider: ModelProvider, input: ModelInput = "text"): boolean {
  if (provider === "open-source" && input === "image") return false
  return providerSettings(provider, input).required.every((entry) => entry.isSet)
}

function requireModel(model: string | undefined, variable: string): string {
  if (!model) {
    throw new UserFacingError(`${variable} is not set. Set it where the app runs (.env.local here, Environment Variables on the host).`)
  }
  return model
}

// When each Groq key may be tried first again, shared by every call this server process makes
const restingGroqKeys = new Map<number, number>()

/**
 * Runs one Groq call with the first usable key. A key that is rejected, rate limited or out of quota
 * hands the same call to the next key (lib/keyRotation.ts), so up to five keys cover for each other;
 * only when every key has failed does the error reach the caller, and the next provider takes over.
 */
export function withGroqKey<T>(call: (apiKey: string) => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (GROQ_API_KEYS.length === 0) {
    return Promise.reject(new UserFacingError(`Groq is not configured. Set ${GROQ_KEY_VARIABLES} where the app runs.`))
  }
  return withKeyRotation(GROQ_API_KEYS, (apiKey) => call(apiKey), {
    isKeyError: isKeyLimitError,
    restMs: (error) => keyRestMs(error, retryAfterOf(error)),
    resting: restingGroqKeys,
    signal,
    onSwitch: (from, to, error) =>
      console.warn(`🔑 Groq key ${from + 1} of ${GROQ_API_KEYS.length} failed (${error instanceof Error ? error.message : error}); trying key ${to + 1}`),
  })
}

/** The Groq chat model (GROQ_MODEL, or GROQ_VISION_MODEL for a screenshot) on one key. */
export function createGroqModel(apiKey: string, options: Omit<ModelOptions, "timeout"> = {}, input: ModelInput = "text"): ChatGroq {
  const model = input === "image" ? requireModel(env.GROQ_VISION_MODEL, "GROQ_VISION_MODEL") : requireModel(env.GROQ_MODEL, "GROQ_MODEL")
  return new ChatGroq({ apiKey, model, temperature: DEFAULT_TEMPERATURE, ...options })
}

/**
 * The open-source model: any OpenAI-compatible server (OPEN_SOURCE_BASE_URL, e.g. Ollama's /v1) and
 * the model it serves (OPEN_SOURCE_MODEL), through the same LangChain client as OpenAI, so it answers
 * in exactly the same shape. A local server usually needs no key.
 */
export function createOpenSourceModel(options: ModelOptions = {}): ChatOpenAI {
  const model = requireModel(env.OPEN_SOURCE_MODEL, "OPEN_SOURCE_MODEL")
  const baseURL = requireModel(env.OPEN_SOURCE_BASE_URL, "OPEN_SOURCE_BASE_URL")
  return new ChatOpenAI({
    apiKey: env.OPEN_SOURCE_API_KEY ?? "not-needed",
    model,
    temperature: DEFAULT_TEMPERATURE,
    configuration: { baseURL },
    ...options,
  })
}

/** The OpenAI chat model from ENV (OPENAI_LIGHTWEIGHT_MODEL). */
export function createOpenAIModel(options: ModelOptions = {}): ChatOpenAI {
  const apiKey = requireModel(env.OPENAI_API_KEY, "OPENAI_API_KEY")
  const model = requireModel(env.OPENAI_LIGHTWEIGHT_MODEL, "OPENAI_LIGHTWEIGHT_MODEL")
  return new ChatOpenAI({ apiKey, model, temperature: DEFAULT_TEMPERATURE, ...options })
}

/** Whether OpenAI can read recordings: its API key and a transcription model are both set in ENV. */
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
 * Writes out a recording with OpenAI's transcription model from ENV (OPENAI_TRANSCRIPTION_MODEL),
 * through OpenAI's own transcription endpoint, retried on transient failures like every other call.
 */
export async function transcribeWithOpenAI(audio: { data: Buffer; mimeType: string }, signal: AbortSignal): Promise<string> {
  const apiKey = env.OPENAI_API_KEY
  const model = env.OPENAI_TRANSCRIPTION_MODEL
  if (!apiKey || !model) {
    const missing = [!apiKey && "OPENAI_API_KEY", !model && "OPENAI_TRANSCRIPTION_MODEL"].filter(Boolean).join(" and ")
    throw new UserFacingError(`Reading recordings with OpenAI needs ${missing}.`)
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

/** Whether Groq can read recordings: a key and a Whisper model (GROQ_TRANSCRIPTION_MODEL) are both set in ENV. */
export function isGroqTranscriptionConfigured(): boolean {
  return Boolean(GROQ_API_KEYS.length > 0 && env.GROQ_TRANSCRIPTION_MODEL)
}

/**
 * Writes out a recording with Whisper on Groq (GROQ_TRANSCRIPTION_MODEL), through Groq's own SDK:
 * LangChain has no speech-to-text interface. Every key is tried before it fails.
 */
export async function transcribeWithGroq(audio: { data: Buffer; mimeType: string }, signal: AbortSignal): Promise<string> {
  const model = env.GROQ_TRANSCRIPTION_MODEL
  if (GROQ_API_KEYS.length === 0 || !model) {
    const missing = [GROQ_API_KEYS.length === 0 && GROQ_KEY_VARIABLES, !model && "GROQ_TRANSCRIPTION_MODEL"].filter(Boolean).join(" and ")
    throw new UserFacingError(`Reading recordings with Groq needs ${missing}.`)
  }

  const transcription = await withProviderRetry(
    "groq",
    () =>
      withGroqKey(async (apiKey) => {
        const client = new Groq({ apiKey, maxRetries: 0 })
        const file = await toGroqFile(audio.data, `recording.${AUDIO_EXTENSIONS[audio.mimeType] ?? "webm"}`, { type: audio.mimeType })
        return client.audio.transcriptions.create({ file, model, response_format: "json", temperature: 0 }, { signal })
      }, signal),
    signal
  )
  return transcription.text
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
  // Providers to try, in order; defaults to the request's order (lib/modelOrder.ts), Groq first
  providers?: readonly ModelProvider[]
  // "image" when the messages carry a screenshot, so only providers with a vision model are tried
  input?: ModelInput
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
  { schema, name, messages, temperature = DEFAULT_TEMPERATURE, input = "text" }: StructuredGenerationOptions<T>,
  signal: AbortSignal
): Promise<T> {
  const modelOptions = { temperature, maxRetries: 0 }
  if (provider === "groq") {
    return withGroqKey(
      (apiKey) => createGroqModel(apiKey, modelOptions, input).withStructuredOutput(schema, { name }).invoke(messages, { signal }),
      signal
    )
  }
  if (provider === "open-source") {
    // Tool calling is what OpenAI-compatible servers support most widely for a structured answer
    return createOpenSourceModel(modelOptions).withStructuredOutput(schema, { name, method: "functionCalling" }).invoke(messages, { signal })
  }
  return createOpenAIModel(modelOptions).withStructuredOutput(schema, { name, strict: true }).invoke(messages, { signal })
}

/** Which variables each unconfigured provider is waiting for, named one provider at a time. */
export function missingConfiguration(providers: readonly ModelProvider[] = currentModelOrder(), input: ModelInput = "text"): string[] {
  return providers
    .filter((provider) => !isProviderConfigured(provider, input) && !(provider === "open-source" && input === "image"))
    .map((provider) => {
      const missing = providerSettings(provider, input)
        .required.filter((entry) => !entry.isSet)
        .map((entry) => entry.variable)
        .join(" and ")
      return `${AI_PROVIDER_LABELS[provider]} needs ${missing}.`
    })
}

/**
 * The single generation path for every module: LangChain structured output, trying the request's
 * providers in order (Groq first by default, every Groq key before the next provider). A transient
 * failure is retried on the same provider first (withProviderRetry); the next provider runs only when
 * one is unconfigured, keeps failing, fails for good (every key rejected or used up), times out or
 * returns output that fails validation, so a successful request never calls two providers. The
 * timeout covers every attempt on one provider.
 */
export async function generateStructuredWithFallback<T extends Record<string, unknown>>(
  options: StructuredGenerationOptions<T>
): Promise<StructuredGeneration<T>> {
  const input = options.input ?? "text"
  const order = options.providers ?? currentModelOrder()
  const providers = order.filter((provider) => isProviderConfigured(provider, input))
  if (providers.length === 0) {
    throw new UserFacingError(
      `No AI provider is configured. ${missingConfiguration(order, input).join(" ")} Set them where the app runs (.env.local here, Environment Variables on the host), then redeploy.`
    )
  }

  let lastError: unknown
  // Why each provider gave up, so a failure can say what to go and change
  const failures: string[] = []
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
      // An output that failed the tool's own check is not a provider problem
      const unusable = error instanceof Error && error.message.startsWith("UnusableOutputException:")
      failures.push(
        unusable ? `${AI_PROVIDER_LABELS[provider]} wrote something the app could not use.` : describeProviderFailure(error, providerNames(provider, input))
      )
      const next = providers[index + 1]
      console.warn(`⚠️ ${provider} generation failed${next ? `, falling back to ${next}` : ""}:`, error instanceof Error ? error.message : error)
      if (next) options.onFallback?.(provider, next)
    }
  }
  // Every provider failed. The reasons are what the user needs, not "please try again"
  if (failures.length > 0) {
    // A provider that was skipped for missing configuration is usually the one meant to cover this
    const skipped = missingConfiguration(order, input)
    const reason = [...failures, ...skipped.map((note) => `${note} It was not tried.`)].join(" ")
    console.error("❌ Every AI provider failed:", reason)
    throw new UserFacingError(reason)
  }
  throw lastError
}
