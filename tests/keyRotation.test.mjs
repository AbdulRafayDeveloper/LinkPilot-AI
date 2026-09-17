import test from "node:test"
import assert from "node:assert/strict"
import load from "./load.mjs"

const { withKeyRotation, keyOrder } = load("lib/keyRotation.ts")
const { isKeyLimitError, keyRestMs } = load("lib/providerErrors.ts")

// Errors shaped the way the Groq SDK and LangChain report them
const failure = (status, message) => Object.assign(new Error(message), { status })
const rejected = () => failure(401, "Invalid API Key")
const rateLimited = () => failure(429, "Rate limit reached for model openai/gpt-oss-120b on tokens per minute (TPM)")
const dailyLimit = () => failure(429, "Rate limit reached on tokens per day (TPD): Limit 200000")
const tooManyTokens = () => failure(413, "Request too large on tokens per minute (TPM): Limit 8000. code rate_limit_exceeded")
const badRequest = () => failure(400, "messages[0].content must be a string")

const options = (resting = new Map(), now = () => 1_000) => ({ isKeyError: isKeyLimitError, restMs: (error) => keyRestMs(error, null), resting, now })

test("the first key is used when it works, and no other key is touched", async () => {
  const used = []
  const result = await withKeyRotation(["k1", "k2", "k3"], async (key) => {
    used.push(key)
    return `answer from ${key}`
  }, options())
  assert.equal(result, "answer from k1")
  assert.deepEqual(used, ["k1"])
})

test("a rejected (revoked) key hands the same call to the next key", async () => {
  const used = []
  const result = await withKeyRotation(["k1", "k2"], async (key) => {
    used.push(key)
    if (key === "k1") throw rejected()
    return "ok"
  }, options())
  assert.equal(result, "ok")
  assert.deepEqual(used, ["k1", "k2"])
})

test("rate limits, daily limits and per-minute token ceilings each move on, key by key, until one succeeds", async () => {
  const used = []
  const errors = { k1: rateLimited(), k2: dailyLimit(), k3: tooManyTokens() }
  const result = await withKeyRotation(["k1", "k2", "k3", "k4", "k5"], async (key) => {
    used.push(key)
    if (errors[key]) throw errors[key]
    return key
  }, options())
  assert.equal(result, "k4")
  assert.deepEqual(used, ["k1", "k2", "k3", "k4"])
})

test("when every key is used up, the last key's error is thrown so the next provider takes over", async () => {
  const used = []
  await assert.rejects(
    withKeyRotation(["k1", "k2", "k3"], async (key) => {
      used.push(key)
      throw key === "k3" ? dailyLimit() : rateLimited()
    }, options()),
    /tokens per day/
  )
  assert.deepEqual(used, ["k1", "k2", "k3"])
})

test("a failure that belongs to the request, not the key, is thrown at once without trying other keys", async () => {
  const used = []
  await assert.rejects(
    withKeyRotation(["k1", "k2"], async (key) => {
      used.push(key)
      throw badRequest()
    }, options()),
    /must be a string/
  )
  assert.deepEqual(used, ["k1"])
})

test("a key that just failed is tried last on the next call, and first again once its rest is over", async () => {
  const resting = new Map()
  let clock = 1_000
  const now = () => clock
  await withKeyRotation(["k1", "k2", "k3"], async (key) => {
    if (key === "k1") throw rateLimited()
    return key
  }, options(resting, now))
  const used = []
  await withKeyRotation(["k1", "k2", "k3"], async (key) => {
    used.push(key)
    return key
  }, options(resting, now))
  assert.deepEqual(used, ["k2"])
  assert.deepEqual(keyOrder(3, resting, clock), [1, 2, 0])
  clock += 61_000
  assert.deepEqual(keyOrder(3, resting, clock), [0, 1, 2])
})

test("a resting key is still tried when every key is resting, so a call is never refused outright", async () => {
  const resting = new Map([
    [0, 5_000],
    [1, 3_000],
  ])
  const used = []
  const result = await withKeyRotation(["k1", "k2"], async (key) => {
    used.push(key)
    return key
  }, options(resting, () => 1_000))
  assert.equal(result, "k2")
  assert.deepEqual(used, ["k2"])
})

test("what counts as a key problem, and how long a key rests", () => {
  assert.equal(isKeyLimitError(rejected()), true)
  assert.equal(isKeyLimitError(failure(403, "Forbidden")), true)
  assert.equal(isKeyLimitError(rateLimited()), true)
  assert.equal(isKeyLimitError(tooManyTokens()), true)
  assert.equal(isKeyLimitError(failure(413, "Request Entity Too Large")), false)
  assert.equal(isKeyLimitError(badRequest()), false)
  assert.equal(isKeyLimitError(failure(503, "Service Unavailable")), false)
  assert.equal(keyRestMs(rejected(), null), 10 * 60_000)
  assert.equal(keyRestMs(dailyLimit(), null), 15 * 60_000)
  assert.equal(keyRestMs(rateLimited(), 7_000), 7_000)
})
