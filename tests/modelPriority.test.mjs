import test from "node:test"
import assert from "node:assert/strict"
import load from "./load.mjs"

const { DEFAULT_MODEL_ORDER, MODEL_PROVIDERS } = load("constants/aiProviders.ts")
const { AI_MODULE_IDS, AI_MODULE_NEEDS, VOICE_MODULE_IDS } = load("constants/modelPriority.ts")
const { ModelOrderSchema } = load("lib/validation/modelPriority.ts")
const { currentModelOrder, resolveModelOrder, withModelOrder } = load("lib/modelOrder.ts")

const ADMIN_ORDER = ["openai", "groq", "open-source"]
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

test("Groq is the default first choice for every module", () => {
  assert.equal(DEFAULT_MODEL_ORDER[0], "groq")
  assert.deepEqual([...DEFAULT_MODEL_ORDER].sort(), [...MODEL_PROVIDERS].sort())
  for (const aiModule of AI_MODULE_IDS) assert.equal(resolveModelOrder("user", null)[0], "groq", aiModule)
})

test("an admin's saved order applies to admins", () => {
  assert.deepEqual(resolveModelOrder("admin", ADMIN_ORDER), ADMIN_ORDER)
})

test("a regular user always gets the default, whatever an admin saved", () => {
  assert.deepEqual(resolveModelOrder("user", ADMIN_ORDER), DEFAULT_MODEL_ORDER)
})

test("an admin with nothing saved, or a saved order that is no longer valid, gets the default", () => {
  assert.deepEqual(resolveModelOrder("admin", null), DEFAULT_MODEL_ORDER)
  assert.deepEqual(resolveModelOrder("admin", ["groq", "openai"]), DEFAULT_MODEL_ORDER)
  assert.deepEqual(resolveModelOrder("admin", ["retired", "groq", "openai"]), DEFAULT_MODEL_ORDER)
})

test("an order must list every provider exactly once", () => {
  assert.equal(ModelOrderSchema.safeParse(ADMIN_ORDER).success, true)
  assert.equal(ModelOrderSchema.safeParse(["groq", "groq", "openai"]).success, false)
  assert.equal(ModelOrderSchema.safeParse(["groq", "openai"]).success, false)
  assert.equal(ModelOrderSchema.safeParse(["groq", "openai", "open-source", "other"]).success, false)
})

test("the request's order is what every AI call inside it reads, across awaits, and nothing leaks outside", async () => {
  assert.deepEqual(currentModelOrder(), DEFAULT_MODEL_ORDER)
  const seen = await withModelOrder(ADMIN_ORDER, async () => {
    await wait(5)
    const later = await new Promise((resolve) => setImmediate(() => resolve(currentModelOrder())))
    return [currentModelOrder(), later]
  })
  for (const order of seen) assert.deepEqual(order, ADMIN_ORDER)
  // Two requests at once keep their own orders
  const [admin, user] = await Promise.all([
    withModelOrder(ADMIN_ORDER, async () => {
      await wait(10)
      return currentModelOrder()
    }),
    withModelOrder(DEFAULT_MODEL_ORDER, async () => {
      await wait(1)
      return currentModelOrder()
    }),
  ])
  assert.deepEqual(admin, ADMIN_ORDER)
  assert.deepEqual(user, DEFAULT_MODEL_ORDER)
  assert.deepEqual(currentModelOrder(), DEFAULT_MODEL_ORDER)
})

test("every module with a priority has its needs listed, and the voice modules are AI modules", () => {
  for (const aiModule of AI_MODULE_IDS) assert.ok(Array.isArray(AI_MODULE_NEEDS[aiModule]), aiModule)
  for (const aiModule of VOICE_MODULE_IDS) assert.ok(AI_MODULE_IDS.includes(aiModule), aiModule)
})
