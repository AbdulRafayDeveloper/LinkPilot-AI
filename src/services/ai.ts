import OpenAI, { toFile } from "openai"
import Groq, { toFile as toGroqFile } from "groq-sdk"
import { ChatOpenAI } from "@langchain/openai"
import { ChatGroq } from "@langchain/groq"
import { Embeddings } from "@langchain/core/embeddings"
import type { BaseMessage } from "@langchain/core/messages"
import type { InteropZodType } from "@langchain/core/utils/types"
import { env, GROQ_API_KEYS, GROQ_KEY_VARIABLES } from "@/config/env"
import { UserFacingError } from "@/lib/errors"
import { describeProviderFailure, isKeyLimitError, keyRestMs, redactSecrets, type ProviderNames } from "@/lib/providerErrors"
import { withKeyRotation } from "@/lib/keyRotation"
import { currentModelOrder } from "@/lib/modelOrder"
import { withRetry } from "@/lib/retry"
import { isTransientError, retryAfterOf } from "@/lib/transientErrors"
import { AI_PROVIDER_LABELS, MODEL_PROVIDERS, type AiProviderId } from "@/constants/aiProviders"
import { recordAiUsage } from "@/services/aiUsage"
import { groqKeyPlan, noteGroqKeyAnswered, noteGroqKeyResting } from "@/services/groqKeyState"
import type { AiText } from "@/types/ai"

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

/** The model a provider answers with, as usage records it. */
export function modelNameOf(provider: ModelProvider, input: ModelInput = "text"): string {
  if (provider === "groq") return (input === "image" ? env.GROQ_VISION_MODEL : env.GROQ_MODEL) ?? "unknown"
  if (provider === "open-source") return env.OPEN_SOURCE_MODEL ?? "unknown"
  return env.OPENAI_LIGHTWEIGHT_MODEL ?? "unknown"
}

function requireModel(model: string | undefined, variable: string): string {
  if (!model) {
    throw new UserFacingError(`${variable} is not set. Set it where the app runs (.env.local here, Environment Variables on the host).`)
  }
  return model
}

/**
 * Runs one Groq call, for every module, starting on the key that answered last (services/groqKeyState.ts,
 * shared by every server instance) and going round the keys from there: after the last key comes the
 * first. A key that is rejected, rate limited or out of quota hands the same call to the next key
 * (lib/keyRotation.ts) and becomes the key calls start from once it answers, so a used-up key is not
 * asked again on every call. Only when every key has failed does the error reach the caller, and the
 * next provider takes over.
 */
export async function withGroqKey<T>(call: (apiKey: string, keyNumber: number) => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (GROQ_API_KEYS.length === 0) {
    throw new UserFacingError(`Groq is not configured. Set ${GROQ_KEY_VARIABLES} where the app runs.`)
  }
  const { start, resting } = await groqKeyPlan()
  const numberOf = (index: number) => GROQ_API_KEYS[index].number
  return withKeyRotation(
    GROQ_API_KEYS.map((key) => key.value),
    (apiKey, index) => call(apiKey, numberOf(index)),
    {
      isKeyError: isKeyLimitError,
      restMs: (error) => keyRestMs(error, retryAfterOf(error)),
      resting,
      start,
      signal,
      onRest: noteGroqKeyResting,
      onAnswer: noteGroqKeyAnswered,
      onSwitch: (from, to, error) =>
        console.warn(
          `🔑 Groq key ${numberOf(from)} (${from + 1} of ${GROQ_API_KEYS.length}) failed (${redactSecrets(error instanceof Error ? error.message : String(error))}); trying key ${numberOf(to)}`
        ),
    }
  )
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
export async function transcribeWithOpenAI(audio: { data: Buffer; mimeType: string }, signal: AbortSignal): Promise<AiText> {
  const apiKey = env.OPENAI_API_KEY
  const model = env.OPENAI_TRANSCRIPTION_MODEL
  if (!apiKey || !model) {
    const missing = [!apiKey && "OPENAI_API_KEY", !model && "OPENAI_TRANSCRIPTION_MODEL"].filter(Boolean).join(" and ")
    throw new UserFacingError(`Reading recordings with OpenAI needs ${missing}.`)
  }

  const client = new OpenAI({ apiKey, maxRetries: 0 })
  const file = await toFile(audio.data, `recording.${AUDIO_EXTENSIONS[audio.mimeType] ?? "webm"}`, { type: audio.mimeType })
  // "json" is a format every transcription model supports, and the newer ones report usage in it
  const transcription = await withProviderRetry(
    "openai",
    () => client.audio.transcriptions.create({ file, model, response_format: "json" }, { signal }),
    signal
  )
  await recordAiUsage({ provider: "openai", model, kind: "speech", usage: (transcription as { usage?: unknown }).usage })
  return { text: transcription.text, provider: "openai" }
}

/** Whether Groq can read recordings: a key and a Whisper model (GROQ_TRANSCRIPTION_MODEL) are both set in ENV. */
export function isGroqTranscriptionConfigured(): boolean {
  return Boolean(GROQ_API_KEYS.length > 0 && env.GROQ_TRANSCRIPTION_MODEL)
}

/**
 * Writes out a recording with Whisper on Groq (GROQ_TRANSCRIPTION_MODEL), through Groq's own SDK:
 * LangChain has no speech-to-text interface. Every key is tried before it fails.
 */
export async function transcribeWithGroq(audio: { data: Buffer; mimeType: string }, signal: AbortSignal): Promise<AiText> {
  const model = env.GROQ_TRANSCRIPTION_MODEL
  if (GROQ_API_KEYS.length === 0 || !model) {
    const missing = [GROQ_API_KEYS.length === 0 && GROQ_KEY_VARIABLES, !model && "GROQ_TRANSCRIPTION_MODEL"].filter(Boolean).join(" and ")
    throw new UserFacingError(`Reading recordings with Groq needs ${missing}.`)
  }

  const { transcription, keyNumber } = await withProviderRetry(
    "groq",
    () =>
      withGroqKey(async (apiKey, keyNumber) => {
        const client = new Groq({ apiKey, maxRetries: 0 })
        const file = await toGroqFile(audio.data, `recording.${AUDIO_EXTENSIONS[audio.mimeType] ?? "webm"}`, { type: audio.mimeType })
        // verbose_json also says how long the recording was, which is what Groq bills speech by
        const answer = await client.audio.transcriptions.create({ file, model, response_format: "verbose_json", temperature: 0 }, { signal })
        return { transcription: answer as typeof answer & { duration?: number }, keyNumber }
      }, signal),
    signal
  )
  await recordAiUsage({ provider: "groq", model, kind: "speech", keyNumber, audioSeconds: transcription.duration ?? null })
  return { text: transcription.text, provider: "groq" }
}

/** Whether text can be turned into vectors here: OpenAI's key and an embedding model are both set. */
export function isEmbeddingConfigured(): boolean {
  return Boolean(env.OPENAI_API_KEY && env.OPENAI_EMBEDDING_MODEL)
}

/**
 * Turning text into vectors, as LangChain expects it (so it plugs straight into the vector store),
 * through OpenAI's embeddings endpoint, because Groq has no embedding model. Every call is counted
 * like any other (services/aiUsage.ts). Documents go in batches; a question is one call.
 */
export class OpenAIEmbeddings extends Embeddings {
  private readonly client: OpenAI
  private readonly model: string

  constructor(private readonly signal?: AbortSignal) {
    super({ maxRetries: 0 })
    const apiKey = env.OPENAI_API_KEY
    const model = env.OPENAI_EMBEDDING_MODEL
    if (!apiKey || !model) {
      const missing = [!apiKey && "OPENAI_API_KEY", !model && "OPENAI_EMBEDDING_MODEL"].filter(Boolean).join(" and ")
      throw new UserFacingError(`Turning text into vectors needs ${missing} where the app runs.`)
    }
    this.client = new OpenAI({ apiKey, maxRetries: 0 })
    this.model = model
  }

  private async embed(input: string[]): Promise<number[][]> {
    const answer = await withProviderRetry("openai", () => this.client.embeddings.create({ model: this.model, input }, { signal: this.signal }), this.signal ?? new AbortController().signal)
    await recordAiUsage({ provider: "openai", model: this.model, kind: "embedding", usage: answer.usage })
    return answer.data.map((entry) => entry.embedding)
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    return this.embed(texts)
  }

  async embedQuery(text: string): Promise<number[]> {
    const [vector] = await this.embed([text])
    return vector
  }
}

export interface StreamedText {
  text: string
  provider: ModelProvider
}

interface StreamOptions {
  messages: BaseMessage[]
  // Called with each piece of the answer as it arrives, so a page can show it being written
  onToken: (text: string) => void
  providers?: readonly ModelProvider[]
  temperature?: number
  maxTokens?: number
  signal: AbortSignal
}

/**
 * One answer in plain text, streamed as it is written, through the request's providers in order
 * (Groq first by default, every Groq key before the next provider). A provider that fails before it
 * has written anything hands over to the next; once text has been sent to the page, that provider's
 * answer is what is used. Used by the meeting chat, where reading the answer appear is the point.
 */
export async function streamTextWithFallback({ messages, onToken, providers, temperature = 0.2, maxTokens, signal }: StreamOptions): Promise<StreamedText> {
  const order = (providers ?? currentModelOrder()).filter((provider) => isProviderConfigured(provider))
  if (order.length === 0) {
    throw new UserFacingError(`No AI provider is configured. ${missingConfiguration().join(" ")}`)
  }

  const failures: string[] = []
  for (const [index, provider] of order.entries()) {
    // streamUsage asks the provider to report the tokens on the last chunk, so a streamed answer is counted too
    const options = { temperature, maxRetries: 0, streamUsage: true, ...(maxTokens ? { maxTokens } : {}) }
    let text = ""
    try {
      const run = async (model: ChatGroq | ChatOpenAI, keyNumber?: number) => {
        let usage: unknown
        for await (const chunk of await model.stream(messages, { signal })) {
          const piece = typeof chunk.content === "string" ? chunk.content : chunk.content.map((part) => ("text" in part && typeof part.text === "string" ? part.text : "")).join("")
          if (piece) {
            text += piece
            onToken(piece)
          }
          // OpenAI reports the tokens as usage_metadata, Groq on the answer's own metadata; lib/aiUsage.ts reads both shapes
          if (chunk.usage_metadata) usage = chunk.usage_metadata
          else if (chunk.response_metadata?.usage) usage = chunk.response_metadata.usage
        }
        await recordAiUsage({ provider, model: modelNameOf(provider), kind: "text", usage, keyNumber })
      }
      if (provider === "groq") await withGroqKey((apiKey, keyNumber) => run(createGroqModel(apiKey, options), keyNumber), signal)
      else if (provider === "open-source") await run(createOpenSourceModel(options))
      else await run(createOpenAIModel(options))
      if (!text.trim()) throw new Error("EmptyAnswerException: the model answered with nothing")
      return { text, provider }
    } catch (error: unknown) {
      if (signal.aborted || text.trim()) throw error
      failures.push(describeProviderFailure(error, providerNames(provider)))
      const next = order[index + 1]
      console.warn(`⚠️ ${provider} answer failed${next ? `, falling back to ${next}` : ""}:`, error instanceof Error ? error.message : error)
    }
  }
  console.error("❌ Every AI provider failed to answer:", failures.join(" "))
  throw new UserFacingError(failures.join(" "))
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

// With includeRaw, a structured call answers with the model's message (which carries the token usage)
// beside the parsed output; an output that doesn't parse comes back as parsingError instead of a throw
interface RawStructured<T> {
  raw: { usage_metadata?: unknown }
  parsed: T | null
  parsingError?: unknown
}

function parsedOf<T>(answer: RawStructured<T>): T {
  if (answer.parsed === null || answer.parsed === undefined) {
    throw answer.parsingError instanceof Error ? answer.parsingError : new Error("StructuredOutputException: the model's answer did not match the schema")
  }
  return answer.parsed
}

async function invokeStructured<T extends Record<string, unknown>>(
  provider: ModelProvider,
  { schema, name, messages, temperature = DEFAULT_TEMPERATURE, input = "text" }: StructuredGenerationOptions<T>,
  signal: AbortSignal
): Promise<T> {
  const modelOptions = { temperature, maxRetries: 0 }
  const kind = input === "image" ? "screenshot" : "text"
  const model = modelNameOf(provider, input)
  if (provider === "groq") {
    return withGroqKey(async (apiKey, keyNumber) => {
      const answer = (await createGroqModel(apiKey, modelOptions, input)
        .withStructuredOutput(schema, { name, includeRaw: true })
        .invoke(messages, { signal })) as RawStructured<T>
      await recordAiUsage({ provider, model, kind, usage: answer.raw.usage_metadata, keyNumber })
      return parsedOf(answer)
    }, signal)
  }
  const answer = (
    provider === "open-source"
      ? // Tool calling is what OpenAI-compatible servers support most widely for a structured answer
        await createOpenSourceModel(modelOptions).withStructuredOutput(schema, { name, method: "functionCalling", includeRaw: true }).invoke(messages, { signal })
      : await createOpenAIModel(modelOptions).withStructuredOutput(schema, { name, strict: true, includeRaw: true }).invoke(messages, { signal })
  ) as RawStructured<T>
  await recordAiUsage({ provider, model, kind, usage: answer.raw.usage_metadata })
  return parsedOf(answer)
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
