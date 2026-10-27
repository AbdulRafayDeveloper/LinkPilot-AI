import { Embeddings } from "@langchain/core/embeddings"
import { env, GEMINI_API_KEYS } from "@/config/env"
import { UserFacingError } from "@/lib/errors"
import { describeGeminiFailures, GeminiError, geminiFailure, geminiKeyRestMs, isGeminiKeyError } from "@/lib/geminiErrors"
import { startKeyFor, withKeyRotation } from "@/lib/keyRotation"
import { withRetry } from "@/lib/retry"
import { isTransientError } from "@/lib/transientErrors"
import { recordAiUsage } from "@/services/aiUsage"
import { createProviderKeyState } from "@/services/providerKeyState"

/**
 * Gemini embeddings, as LangChain expects them, so they plug straight into LangChain's MongoDB vector
 * store. Gemini only ever turns text into vectors here; it never writes a word.
 *
 * It is a LangChain `Embeddings` of our own, over Gemini's REST endpoint, rather than the
 * `@langchain/google-genai` package, for the same reason the OpenAI one in services/ai.ts is: a call
 * has to go round **several keys** (GEMINI_API_KEY_1, _2 … each from its own Google account), and that
 * package holds one key per instance and retries on its own. The keys go round exactly as Groq's do
 * (lib/keyRotation.ts, services/providerKeyState.ts): a call starts on the key after the one that
 * answered last, a key that is rejected or out of quota hands the same call to the next, after the
 * last key comes the first again, and only when every key has failed does the person see why, key by
 * key (lib/geminiErrors.ts).
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"
// Gemini takes at most 100 texts in one batch
const BATCH_SIZE = 100
const CALL_TIMEOUT_MS = 30_000
// When every key is at its minute's limit, wait this long for the first one back before giving up
const KEY_WAIT_MS = 8_000
const KEY_VARIABLES = "GEMINI_API_KEY_1, GEMINI_API_KEY_2 …"

const geminiKeys = createProviderKeyState("gemini", "Gemini", GEMINI_API_KEYS)
let callsInFlight = 0

/** What Gemini embeddings still need before they can run, by variable name; empty when ready. */
export function missingGeminiConfiguration(): string[] {
  return [
    GEMINI_API_KEYS.length === 0 && KEY_VARIABLES,
    !env.GEMINI_EMBEDDING_MODEL && "GEMINI_EMBEDDING_MODEL",
    !env.GEMINI_EMBEDDING_DIMENSIONS && "GEMINI_EMBEDDING_DIMENSIONS",
  ].filter((name): name is string => Boolean(name))
}

export const isGeminiEmbeddingConfigured = (): boolean => missingGeminiConfiguration().length === 0

/** The model and length every vector is written with, which a stored vector is compared against. */
export function geminiEmbeddingSettings(): { model: string; dimensions: number } {
  const missing = missingGeminiConfiguration()
  if (missing.length > 0) throw new UserFacingError(`Saving your profile for search needs ${missing.join(", ")} where the app runs.`)
  return { model: env.GEMINI_EMBEDDING_MODEL as string, dimensions: env.GEMINI_EMBEDDING_DIMENSIONS as number }
}

/** The number of the key the next call starts on (GEMINI_API_KEY_<n>), or null with no keys. */
export const activeGeminiKeyNumber = geminiKeys.activeKeyNumber

// A stored profile entry, or a question asked of the profile: Gemini writes each kind of vector for its job
export type GeminiTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"

interface BatchAnswer {
  embeddings?: { values?: number[] }[]
  usageMetadata?: { promptTokenCount?: number }
}

/**
 * Runs one Gemini call on the keys, starting after the key that answered last. Each key's failure is
 * kept, so when every key has failed the person reads what happened to each one.
 */
async function withGeminiKey<T>(call: (apiKey: string, keyNumber: number) => Promise<T>, signal?: AbortSignal): Promise<T> {
  const { start, resting } = await geminiKeys.plan()
  const from = startKeyFor(start, callsInFlight, GEMINI_API_KEYS.length)
  const failures = new Map<number, unknown>()
  callsInFlight += 1
  try {
    return await withKeyRotation(
      GEMINI_API_KEYS.map((key) => key.value),
      async (apiKey, index) => {
        const number = GEMINI_API_KEYS[index].number
        try {
          return await call(apiKey, number)
        } catch (error: unknown) {
          failures.set(number, error)
          throw error
        }
      },
      {
        isKeyError: isGeminiKeyError,
        restMs: geminiKeyRestMs,
        resting,
        start: from,
        signal,
        maxWaitMs: KEY_WAIT_MS,
        onRest: geminiKeys.noteResting,
        onAnswer: geminiKeys.noteAnswered,
        onWait: (index, waitMs) => console.warn(`🔑 Every Gemini key is at its minute's limit; waiting ${(waitMs / 1000).toFixed(1)}s for key ${GEMINI_API_KEYS[index].number}`),
        onSwitch: (fromIndex, toIndex, error) =>
          console.warn(
            `🔑 Gemini key ${GEMINI_API_KEYS[fromIndex].number} (${fromIndex + 1} of ${GEMINI_API_KEYS.length}) failed (${error instanceof Error ? error.message : String(error)}); trying key ${GEMINI_API_KEYS[toIndex].number}`
          ),
      }
    )
  } catch (error: unknown) {
    if (isGeminiKeyError(error)) throw new UserFacingError(describeGeminiFailures(failures, GEMINI_API_KEYS.length))
    if (error instanceof GeminiError && error.kind === "model") {
      throw new UserFacingError(`Gemini does not have the embedding model named in GEMINI_EMBEDDING_MODEL (${env.GEMINI_EMBEDDING_MODEL}). Check that value.`)
    }
    if (error instanceof GeminiError) throw new UserFacingError(`Gemini could not turn your profile into vectors: ${error.message}`)
    throw error
  } finally {
    callsInFlight -= 1
  }
}

export class GeminiEmbeddings extends Embeddings {
  private readonly model: string
  private readonly dimensions: number

  constructor(
    private readonly task: GeminiTask,
    private readonly signal?: AbortSignal
  ) {
    super({ maxRetries: 0 })
    const settings = geminiEmbeddingSettings()
    this.model = settings.model
    this.dimensions = settings.dimensions
  }

  /** One batch of at most BATCH_SIZE texts, one vector each, in the same order. */
  private async embedBatch(texts: string[]): Promise<number[][]> {
    const body = JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${this.model}`,
        content: { parts: [{ text }] },
        taskType: this.task,
        outputDimensionality: this.dimensions,
      })),
    })
    const { answer, keyNumber } = await withGeminiKey(
      (apiKey, number) =>
        // A dropped connection or Google's own 5xx is tried again on the same key; a key's own refusal goes to the next key
        withRetry(
          async () => {
            const timeout = AbortSignal.timeout(CALL_TIMEOUT_MS)
            const response = await fetch(`${ENDPOINT}/${this.model}:batchEmbedContents`, {
              method: "POST",
              headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
              body,
              signal: this.signal ? AbortSignal.any([this.signal, timeout]) : timeout,
            })
            const json: unknown = await response.json().catch(() => null)
            if (!response.ok) throw geminiFailure(response.status, json)
            return { answer: (json ?? {}) as BatchAnswer, keyNumber: number }
          },
          {
            retries: 2,
            signal: this.signal,
            shouldRetry: (error) => (error instanceof GeminiError ? error.kind === "other" && error.status >= 500 : isTransientError(error)),
          }
        ),
      this.signal
    )
    const vectors = (answer.embeddings ?? []).map((entry) => entry.values ?? [])
    if (vectors.length !== texts.length || vectors.some((vector) => vector.length === 0)) {
      throw new UserFacingError("Gemini answered without a vector for every piece of your profile. Save it again in a moment.")
    }
    const tokens = answer.usageMetadata?.promptTokenCount
    await recordAiUsage({
      provider: "gemini",
      model: this.model,
      kind: "embedding",
      usage: typeof tokens === "number" ? { input_tokens: tokens, output_tokens: 0, total_tokens: tokens } : undefined,
      keyNumber,
    })
    return vectors
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = []
    for (let at = 0; at < texts.length; at += BATCH_SIZE) vectors.push(...(await this.embedBatch(texts.slice(at, at + BATCH_SIZE))))
    return vectors
  }

  async embedQuery(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([text])
    return vector
  }
}
