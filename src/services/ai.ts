import { ChatOpenAI } from "@langchain/openai"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import type { BaseMessage } from "@langchain/core/messages"
import type { InteropZodType } from "@langchain/core/utils/types"
import { env } from "@/config/env"
import { UserFacingError } from "@/lib/errors"

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
 * The OpenAI fallback chat model from ENV (GPT-4o Mini).
 */
export function createOpenAIModel(options: ModelOptions = {}): ChatOpenAI {
  const { apiKey, model } = requireProvider("openai")
  return new ChatOpenAI({ apiKey, model, temperature: DEFAULT_TEMPERATURE, ...options })
}

const DEFAULT_GENERATION_TIMEOUT_MS = 45_000
const GENERATION_MAX_RETRIES = 1

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
  const modelOptions = { temperature, maxRetries: GENERATION_MAX_RETRIES }
  if (provider === "gemini") {
    return createGeminiModel(modelOptions).withStructuredOutput(schema, { name }).invoke(messages, { signal })
  }
  return createOpenAIModel(modelOptions).withStructuredOutput(schema, { name, strict: true }).invoke(messages, { signal })
}

/**
 * The single generation path for every LinkedIn tool: LangChain structured output with
 * Gemini first and OpenAI (GPT-4o Mini) only as the fallback. The fallback runs only when
 * Gemini is unconfigured, errors, times out or returns output that fails validation, so a
 * successful request never calls both providers.
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
      const data = await invokeStructured(provider, options, signal)
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
