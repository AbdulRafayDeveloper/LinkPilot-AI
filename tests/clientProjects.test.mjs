import test from "node:test"
import assert from "node:assert/strict"
import load from "./load.mjs"

const { ClientProjectSchema } = load("lib/validation/clientProject.ts")
const { ClientSchema } = load("lib/validation/client.ts")
const { ClientProjectModel } = load("models/ClientProject.ts")
const { PromptProjectModel } = load("models/PromptProject.ts")
const {
  CLIENTS_TOOL,
  CLIENT_PROJECT_NAME_MAX_LENGTH,
  CLIENT_PROJECT_DESCRIPTION_MAX_LENGTH,
  CLIENT_PROJECT_STATUS_IDS,
  DEFAULT_CLIENT_PROJECT_STATUS,
} = load("constants/clients.ts")
const { APP_TOOLS, TOOL_GROUPS } = load("constants/linkedinTools.ts")
const { SEO_PAGES } = load("constants/seo.ts")
const { SAMPLE_MESSAGE_COUNT } = load("constants/clientMessaging.ts")

const parse = (input) => ClientProjectSchema.safeParse(input)

test("a project needs a name, and the name is tidied the way a client's is", () => {
  assert.equal(parse({ name: "" }).success, false, "an empty name is refused")
  assert.equal(parse({}).success, false, "a missing name is refused")
  assert.equal(parse({ name: "   " }).success, false, "spaces alone are not a name")
  assert.equal(parse({ name: "  Booking site rebuild  " }).data.name, "Booking site rebuild", "the name is trimmed")
  assert.equal(parse({ name: "x".repeat(CLIENT_PROJECT_NAME_MAX_LENGTH) }).success, true, "a name at the limit is kept")
  assert.equal(parse({ name: "x".repeat(CLIENT_PROJECT_NAME_MAX_LENGTH + 1) }).success, false, "a longer name is refused")
})

test("a project can be added by name alone, and starts active", () => {
  const added = parse({ name: "Booking site rebuild" })
  assert.equal(added.success, true)
  assert.equal(added.data.description, "", "what the work is can be written later")
  assert.equal(added.data.status, DEFAULT_CLIENT_PROJECT_STATUS)
  assert.equal(DEFAULT_CLIENT_PROJECT_STATUS, "active")
})

test("the description has the room a client's message format has, and no more", () => {
  const atLimit = "x".repeat(CLIENT_PROJECT_DESCRIPTION_MAX_LENGTH)
  assert.equal(parse({ name: "Site", description: atLimit }).success, true)
  assert.equal(parse({ name: "Site", description: `${atLimit}x` }).success, false)
})

test("only a status the module has is accepted", () => {
  for (const status of CLIENT_PROJECT_STATUS_IDS) {
    assert.equal(parse({ name: "Site", status }).success, true, `${status} is a status`)
  }
  assert.equal(parse({ name: "Site", status: "archived" }).success, false, "anything else is refused")
  assert.deepEqual([...CLIENT_PROJECT_STATUS_IDS], ["active", "completed"])
})

test("a project record keeps its _id and the client it belongs to", async () => {
  const doc = new ClientProjectModel({ ownerId: "account", clientId: "6aac46349c1019d7aa40b7c0", name: "Booking site rebuild" })
  await doc.validate()
  assert.ok(doc._id, "a record without an _id could not be saved")
  assert.equal(doc.clientId, "6aac46349c1019d7aa40b7c0")
  assert.equal(doc.status, DEFAULT_CLIENT_PROJECT_STATUS, "it starts active")
  assert.equal(doc.description, "", "the description defaults to nothing")
})

test("a project with no client is refused, so one can never be left pointing at nothing", async () => {
  const orphan = new ClientProjectModel({ ownerId: "account", name: "Booking site rebuild" })
  await assert.rejects(() => orphan.validate(), "a project must name its client")
})

test("a client's project and a Prompt Creator project are separate records that never share a collection", () => {
  assert.equal(ClientProjectModel.collection.name, "client_projects")
  assert.equal(PromptProjectModel.collection.name, "prompt_projects")
  assert.notEqual(ClientProjectModel.collection.name, PromptProjectModel.collection.name)
  // The Prompt Creator's project carries standing instructions for a prompt; a client's carries the work
  assert.ok(PromptProjectModel.schema.path("instructions"), "a prompt project has its instructions")
  assert.equal(ClientProjectModel.schema.path("instructions"), undefined, "a client project has none")
  assert.ok(ClientProjectModel.schema.path("clientId"), "a client project belongs to a client")
  assert.equal(PromptProjectModel.schema.path("clientId"), undefined, "a prompt project belongs to no client")
})

test("Clients Management is listed once, under Client Work, and before what is written to them", () => {
  const ids = APP_TOOLS.map((tool) => tool.id)
  assert.equal(ids.filter((id) => id === CLIENTS_TOOL.id).length, 1, "listed exactly once")
  assert.equal(CLIENTS_TOOL.group, "clients")
  assert.ok(
    TOOL_GROUPS.some((group) => group.id === CLIENTS_TOOL.group),
    "its group is one of the sidebar headings"
  )
  assert.ok(
    ids.indexOf("clients") < ids.indexOf("client-messaging"),
    "the people the work is for come before the messages written to them"
  )
})

test("the new page gets its search and sharing text from the one tool list", () => {
  const page = SEO_PAGES.find((entry) => entry.path === CLIENTS_TOOL.href)
  assert.ok(page, "the Clients page has an SEO entry")
  assert.equal(page.slug, "clients")
  assert.equal(page.heading, CLIENTS_TOOL.title)
  assert.ok(page.description.length > 0)
})

test("the client the new module writes is exactly the client the messaging module already reads", () => {
  const client = {
    name: "  Sara   Malik ",
    country: " United Kingdom ",
    messageFormat: " Greeting, what moved, what is next. ",
    sampleMessages: Array.from({ length: SAMPLE_MESSAGE_COUNT }, (_, index) => `Sample ${index + 1}`),
  }
  const parsed = ClientSchema.safeParse(client)
  assert.equal(parsed.success, true, "the shared schema still accepts it")
  assert.equal(parsed.data.sampleMessages.length, SAMPLE_MESSAGE_COUNT)
  // A client still needs every sample filled in, which is what the generated message follows
  assert.equal(
    ClientSchema.safeParse({ ...client, sampleMessages: ["only one", ""] }).success,
    false,
    "a blank sample is still refused"
  )
})
