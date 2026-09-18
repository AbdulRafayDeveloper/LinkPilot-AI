import test from "node:test"
import assert from "node:assert/strict"
import load from "./load.mjs"

const { appendInstructions } = load("lib/promptInstructions.ts")
const { ProjectInputSchema, ProjectChangesSchema, ProjectIdSchema } = load("lib/validation/promptProjects.ts")
const { PROJECT_INSTRUCTIONS_MAX_LENGTH, PROJECT_NAME_MAX_LENGTH } = load("constants/promptProjects.ts")

test("a project's instructions go on the end of the prompt, under a heading", () => {
  assert.equal(appendInstructions("Do the thing.", "Answer in British English."), "Do the thing.\n\nADDITIONAL INSTRUCTIONS\nAnswer in British English.")
})

test("a project with no instructions leaves the prompt exactly as it was", () => {
  assert.equal(appendInstructions("Do the thing.", ""), "Do the thing.")
  assert.equal(appendInstructions("Do the thing.", "   \n  "), "Do the thing.")
})

test("instructions already in the prompt are not added twice", () => {
  const prompt = "Do the thing.\n\nADDITIONAL INSTRUCTIONS\nAnswer in British English."
  assert.equal(appendInstructions(prompt, "Answer in British English."), prompt)
})

test("a project needs a name, and one name is tidied to single spaces", () => {
  assert.equal(ProjectInputSchema.safeParse({ name: "  Clinic   booking  app " }).data?.name, "Clinic booking app")
  assert.equal(ProjectInputSchema.safeParse({ name: "   " }).success, false)
  assert.equal(ProjectInputSchema.safeParse({ name: "x".repeat(PROJECT_NAME_MAX_LENGTH + 1) }).success, false)
  // Instructions are optional, and empty when none are given
  assert.equal(ProjectInputSchema.safeParse({ name: "Clinic app" }).data?.instructions, "")
  assert.equal(ProjectInputSchema.safeParse({ name: "Clinic app", instructions: "x".repeat(PROJECT_INSTRUCTIONS_MAX_LENGTH + 1) }).success, false)
})

test("a change names what it changes: the name, the instructions, or both", () => {
  assert.equal(ProjectChangesSchema.safeParse({ name: "Renamed" }).success, true)
  assert.equal(ProjectChangesSchema.safeParse({ instructions: "Use Next.js 16." }).success, true)
  assert.equal(ProjectChangesSchema.safeParse({}).success, false)
})

test("a prompt names its project by id, or null for no project", () => {
  assert.equal(ProjectIdSchema.safeParse("6aabfcfcd04f6e7f3d12ca17").success, true)
  assert.equal(ProjectIdSchema.safeParse(null).success, true)
  assert.equal(ProjectIdSchema.safeParse("not-an-id").success, false)
})
