import test from "node:test"
import assert from "node:assert/strict"

// The route reads config/env.ts as it loads; nothing here connects to anything.
process.env.NEXT_PUBLIC_BASE_URL ??= "http://localhost:3000"
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/tests"
process.env.AUTH_SECRET ??= "a-test-secret-that-is-long-enough-32"

const load = (await import("./load.mjs")).default
const { CreateSchema } = load("app/api/daily-tasks/route.ts")
const { PlanSchema } = load("lib/validation/employees.ts")

const ASSET = "6aac46349c1019d7aa40b7c0"
const today = new Date().toISOString().slice(0, 10)
const base = { today, taskDate: today }

test("a plain list of lines is still exactly what it always was", () => {
  const parsed = CreateSchema.parse({ ...base, contents: ["Ship the payments fix", "Reply to Fleetly"] })
  assert.deepEqual(parsed.contents, ["Ship the payments fix", "Reply to Fleetly"])
})

test("a row can carry a description and an image, and a row without them stays a line", () => {
  const parsed = CreateSchema.parse({
    ...base,
    contents: [
      "Reply to Fleetly",
      { content: "Ship the payments fix", description: "  Staging is green  ", image: { assetId: ASSET, contentType: "image/png" } },
    ],
  })
  assert.equal(parsed.contents[0], "Reply to Fleetly", "an untouched row is sent as its line alone")
  assert.deepEqual(parsed.contents[1], {
    content: "Ship the payments fix",
    description: "Staging is green",
    image: { assetId: ASSET, contentType: "image/png" },
  })
})

test("a row with details left empty is accepted and carries nothing", () => {
  const parsed = CreateSchema.parse({ ...base, contents: [{ content: "Call the supplier" }] })
  assert.deepEqual(parsed.contents[0], { content: "Call the supplier", description: "", image: null })
})

test("what a task may not carry is refused, whichever shape the row is in", () => {
  assert.equal(
    CreateSchema.safeParse({ ...base, contents: [{ content: "x", image: { assetId: "../secret", contentType: "image/png" } }] }).success,
    false,
    "an id that is not one the server issued"
  )
  assert.equal(
    CreateSchema.safeParse({ ...base, contents: [{ content: "x", image: { assetId: ASSET, contentType: "image/svg+xml" } }] }).success,
    false,
    "a type the picker would never produce"
  )
  assert.equal(CreateSchema.safeParse({ ...base, contents: [{ content: "x", description: "y".repeat(2001) }] }).success, false, "a description over the limit")
})

test("a task still belongs to a day that has happened, detail or no detail", () => {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  assert.equal(CreateSchema.safeParse({ today, taskDate: tomorrow, contents: [{ content: "x" }] }).success, false)
})

test("an employee's plan task takes the same two fields, checked the same way", () => {
  const item = { id: "task-1", text: "Fix the booking form" }
  const parsed = PlanSchema.parse({
    today,
    notes: "",
    items: [{ ...item, description: " Check staging first ", image: { assetId: ASSET, contentType: "image/webp" } }],
  })
  assert.equal(parsed.items[0].description, "Check staging first")
  assert.deepEqual(parsed.items[0].image, { assetId: ASSET, contentType: "image/webp" })

  // A plan saved without them, as every plan was before this, still saves
  const plain = PlanSchema.parse({ today, notes: "", items: [item] })
  assert.equal(plain.items[0].description, "")
  assert.equal(plain.items[0].image, null)

  assert.equal(PlanSchema.safeParse({ today, notes: "", items: [{ ...item, image: { assetId: "nope", contentType: "image/png" } }] }).success, false)
})
