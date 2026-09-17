import test from "node:test"
import assert from "node:assert/strict"
import load from "./load.mjs"

const records = load("models/GenerationRecords.ts")

// Every model the tools save their outputs with
const MODELS = Object.entries(records).filter(([, value]) => typeof value === "function" && value.schema && value.modelName)

test("every generation record keeps its _id (a record without one can't be saved)", () => {
  assert.ok(MODELS.length >= 9, `found ${MODELS.length} record models`)
  for (const [name, Model] of MODELS) {
    assert.ok(Model.schema.path("_id"), `${name} has no _id path`)
    assert.ok(new Model({ result: {} })._id, `${name} gets no _id`)
  }
})

test("a record copies who wrote it from its result, so a list can show the source", async () => {
  const { RewrittenMessageRecord } = records
  const doc = new RewrittenMessageRecord({
    ownerId: "account",
    original: "kal meeting",
    message: "The meeting is tomorrow.",
    sourceLanguage: "Urdu",
    characterCount: 24,
    result: { message: "The meeting is tomorrow.", provider: "groq", providers: ["groq"] },
  })
  await doc.validate()
  assert.equal(doc.get("provider"), "groq")
  const older = new RewrittenMessageRecord({ ownerId: "account", original: "a", message: "b", characterCount: 1, result: { message: "b" } })
  await older.validate()
  assert.equal(older.get("provider"), null)
})
