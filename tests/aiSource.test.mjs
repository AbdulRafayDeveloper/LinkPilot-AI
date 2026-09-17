import test from "node:test"
import assert from "node:assert/strict"
import load from "./load.mjs"

const { describeSource } = load("constants/aiProviders.ts")
const { currentSource, noteProviderAnswered, sourceFrom, withModelOrder, currentAiRequest } = load("lib/modelOrder.ts")
const { readTokenUsage } = load("lib/aiUsage.ts")
const { DEFAULT_MODEL_ORDER } = load("constants/aiProviders.ts")

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

test("the source label names the provider, and any other that answered", () => {
  assert.equal(describeSource({ provider: "groq", providers: ["groq"] }), "Source: Groq")
  assert.equal(describeSource({ provider: "openai", providers: ["groq", "openai"] }), "Source: OpenAI (Groq also answered)")
  assert.equal(describeSource({ provider: "open-source" }), "Source: Open-source model")
})

test("no label for a result without a known provider (saved before attribution, or a retired provider)", () => {
  assert.equal(describeSource(null), null)
  assert.equal(describeSource({}), null)
  assert.equal(describeSource({ provider: null, providers: [] }), null)
  assert.equal(describeSource({ provider: "retired-provider", providers: ["retired-provider"] }), null)
})

test("a request's source is the last provider that answered, and every provider once", () => {
  assert.deepEqual(sourceFrom([]), { provider: null, providers: [] })
  assert.deepEqual(sourceFrom(["groq", "groq", "openai", "groq"]), { provider: "groq", providers: ["groq", "openai"] })
})

test("every answer inside a request is noted on that request only, with its module and account", async () => {
  noteProviderAnswered("openai")
  assert.deepEqual(currentSource(), { provider: null, providers: [] })

  const [first, second] = await Promise.all([
    withModelOrder(
      DEFAULT_MODEL_ORDER,
      async () => {
        noteProviderAnswered("groq")
        await wait(10)
        noteProviderAnswered("openai")
        return { source: currentSource(), request: currentAiRequest() }
      },
      { module: "connection-note", ownerId: "account-1" }
    ),
    withModelOrder(DEFAULT_MODEL_ORDER, async () => {
      await wait(2)
      noteProviderAnswered("groq")
      return { source: currentSource(), request: currentAiRequest() }
    }),
  ])
  assert.deepEqual(first.source, { provider: "openai", providers: ["groq", "openai"] })
  assert.deepEqual(first.request, { module: "connection-note", ownerId: "account-1" })
  assert.deepEqual(second.source, { provider: "groq", providers: ["groq"] })
  assert.deepEqual(second.request, { module: null, ownerId: null })
})

test("token usage is read from every SDK shape, and nothing is invented when it is missing", () => {
  // LangChain usage_metadata (Groq and OpenAI chat through LangChain)
  assert.deepEqual(readTokenUsage({ input_tokens: 120, output_tokens: 30, total_tokens: 150 }), { inputTokens: 120, outputTokens: 30, totalTokens: 150, audioSeconds: null })
  // Chat completions usage (Groq browser search)
  assert.deepEqual(readTokenUsage({ prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1200 }), { inputTokens: 1000, outputTokens: 200, totalTokens: 1200, audioSeconds: null })
  // A total left out is added up from the parts
  assert.equal(readTokenUsage({ input_tokens: 10, output_tokens: 5 }).totalTokens, 15)
  // OpenAI transcription billed by duration
  assert.equal(readTokenUsage({ type: "duration", seconds: 42 }).audioSeconds, 42)
  assert.deepEqual(readTokenUsage(undefined), { inputTokens: null, outputTokens: null, totalTokens: null, audioSeconds: null })
  assert.deepEqual(readTokenUsage({ input_tokens: "lots" }), { inputTokens: null, outputTokens: null, totalTokens: null, audioSeconds: null })
})
