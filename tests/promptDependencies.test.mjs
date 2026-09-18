import test from "node:test"
import assert from "node:assert/strict"
import load from "./load.mjs"

const { dependencyState, pendingDependencies, canRun, cleanDependencyIds, findLoop } = load("lib/promptDependencies.ts")
const { describePending, DEPENDENCY_FILTERS, MAX_DEPENDENCIES } = load("constants/promptDependencies.ts")
const { DependencyIdsSchema } = load("lib/validation/promptDependencies.ts")
const { savedOutputsQuerySchema } = load("lib/validation/savedOutputs.ts")
const { SAVED_OUTPUT_TOOLS } = load("constants/savedOutputs.ts")
const { CreatedPromptModel } = load("models/CreatedPrompt.ts")

const id = (n) => `6aac46349c1019d7aa40b7c${n}`
const ran = (n, name) => ({ id: id(n), name, appliedAt: "2026-09-18T10:00:00.000Z" })
const waiting = (n, name) => ({ id: id(n), name, appliedAt: null })

// A prompt is run by applying it, so what has run is what has been applied
test("a prompt that waits for nothing is independent, and can always be run", () => {
  assert.equal(dependencyState([]), "independent")
  assert.equal(canRun([]), true)
})

test("a prompt is ready once every prompt it waits for has run", () => {
  const dependencies = [ran(0, "Set the schema up"), ran(1, "Write the queries")]
  assert.equal(dependencyState(dependencies), "ready")
  assert.deepEqual(pendingDependencies(dependencies), [])
  assert.equal(canRun(dependencies), true)
})

test("one prompt that has not run leaves it blocked, however many have", () => {
  const dependencies = [ran(0, "Set the schema up"), waiting(1, "Write the queries")]
  assert.equal(dependencyState(dependencies), "blocked")
  assert.deepEqual(
    pendingDependencies(dependencies).map((entry) => entry.name),
    ["Write the queries"]
  )
  assert.equal(canRun(dependencies), false)
})

test("the three states never overlap, so the filters add up to the whole list", () => {
  const states = DEPENDENCY_FILTERS.map((filter) => filter.id)
  assert.deepEqual(states, ["independent", "ready", "blocked"])
  assert.equal(new Set(states).size, states.length)
  assert.equal(dependencyState([waiting(0, "A"), ran(1, "B")]), "blocked", "waiting beats having run")
})

test("what is stopping a blocked prompt is named, so the message says what to run", () => {
  assert.match(describePending(["Set the schema up"]), /"Set the schema up"/)
  assert.match(describePending(["A", "B"]), /"A" and "B"/)
  const many = describePending(["A", "B", "C", "D", "E"])
  assert.match(many, /"A", "B", "C" and 2 more/, many)
})

test("what is really saved is each prompt once, never itself, and never more than the limit", () => {
  assert.deepEqual(cleanDependencyIds([id(0), id(0), id(1)], id(9)), [id(0), id(1)], "asked for twice, saved once")
  assert.deepEqual(cleanDependencyIds([id(0), id(9)], id(9)), [id(0)], "a prompt can't wait for itself")
  assert.deepEqual(cleanDependencyIds([" ", ""], id(9)), [], "nothing is saved from blanks")
  const tooMany = Array.from({ length: MAX_DEPENDENCIES + 5 }, (_, index) => `${index}`.padStart(24, "a"))
  assert.equal(cleanDependencyIds(tooMany, id(9)).length, MAX_DEPENDENCIES)
  // The order picked is the order to work in, so it is kept
  assert.deepEqual(cleanDependencyIds([id(2), id(0), id(1)], id(9)), [id(2), id(0), id(1)])
})

test("a loop is caught before it is written, so no prompt is left blocked for ever", () => {
  // B already waits for A: making A wait for B would close the loop
  const waitsFor = new Map([
    [id(1), [id(0)]],
    [id(2), [id(1)]],
  ])
  assert.equal(findLoop(id(0), [id(1)], waitsFor), id(1), "a straight loop")
  assert.equal(findLoop(id(0), [id(2)], waitsFor), id(1), "a loop through another prompt")
  assert.equal(findLoop(id(0), [id(0)], waitsFor), id(0), "waiting for itself")
})

test("two prompts waiting for the same one is not a loop", () => {
  // A and B both wait for C; C waits for nothing
  const waitsFor = new Map([
    [id(1), [id(3)]],
    [id(2), [id(3)]],
    [id(3), []],
  ])
  assert.equal(findLoop(id(4), [id(1), id(2)], waitsFor), null)
})

test("the dependency filter takes the three states and nothing else", () => {
  const promptCreator = SAVED_OUTPUT_TOOLS.find((tool) => tool.id === "prompt-creator")
  const connectionNote = SAVED_OUTPUT_TOOLS.find((tool) => tool.id === "connection-note")
  const asked = (tool, dependencies) => savedOutputsQuerySchema(tool).parse({ page: "1", dependencies }).dependencies

  assert.ok(promptCreator.dependencies, "Prompt Creator's prompts wait for each other")
  assert.equal(connectionNote.dependencies, undefined, "no other tool has dependencies")
  assert.equal(asked(promptCreator, "blocked"), "blocked")
  assert.equal(asked(promptCreator, "ready"), "ready")
  assert.equal(asked(promptCreator, "independent"), "independent")
  assert.equal(asked(promptCreator, ""), "", "no dependency filter at all")
  assert.equal(asked(promptCreator, "nonsense"), "", "a value nobody could have picked shows everything")
  // A tool whose records never wait refuses the parameter outright, exactly as it refuses a folder,
  // so a filter can never look applied on a page that has no such filter
  assert.equal(savedOutputsQuerySchema(connectionNote).safeParse({ page: "1", dependencies: "blocked" }).success, false)
  assert.equal(asked(connectionNote, ""), "", "and asking for nothing is fine")
})

test("only real record ids can be saved, and only so many of them", () => {
  assert.deepEqual(DependencyIdsSchema.parse([id(0), id(1)]), [id(0), id(1)])
  assert.equal(DependencyIdsSchema.safeParse(["not-an-id"]).success, false)
  assert.equal(DependencyIdsSchema.safeParse(Array.from({ length: MAX_DEPENDENCIES + 1 }, () => id(0))).success, false)
  assert.deepEqual(DependencyIdsSchema.parse([]), [], "an empty list makes a prompt independent again")
})

test("a prompt saved before dependencies existed reads as independent", () => {
  const prompt = new CreatedPromptModel({
    ownerId: "account",
    name: "Write the tests",
    prompt: "TASK...",
    target: "editor-agent",
    request: "write tests",
    requestSource: "text",
  })
  assert.deepEqual(prompt.dependencyIds, [], "nothing to wait for")
  assert.equal(dependencyState([]), "independent")
  assert.equal(prompt.appliedAt, null, "and it has not run yet")
})
