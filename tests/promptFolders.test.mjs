import test from "node:test"
import assert from "node:assert/strict"
import load from "./load.mjs"

const { savedOutputsQuerySchema } = load("lib/validation/savedOutputs.ts")
const { SAVED_OUTPUT_TOOLS } = load("constants/savedOutputs.ts")
const { IN_ANY_FOLDER, UNFILED_FOLDER } = load("constants/promptFolders.ts")

const promptCreator = SAVED_OUTPUT_TOOLS.find((tool) => tool.id === "prompt-creator")
const connectionNote = SAVED_OUTPUT_TOOLS.find((tool) => tool.id === "connection-note")

// What the page sends when a folder choice is picked, read the way the route reads it
const folderAsked = (tool, folder) => savedOutputsQuerySchema(tool).parse({ page: "1", folder }).folder

test("only Prompt Creator has folders, so only its page can ask for one", () => {
  assert.ok(promptCreator.folders, "Prompt Creator is filed in folders")
  assert.equal(connectionNote.folders, undefined, "no other tool has folders")
})

test("the folder filter takes one folder, everything filed, everything unfiled, or everything", () => {
  const folderId = "6aac46349c1019d7aa40b7c0"
  assert.equal(folderAsked(promptCreator, folderId), folderId, "one folder")
  assert.equal(folderAsked(promptCreator, IN_ANY_FOLDER), IN_ANY_FOLDER, "every prompt in a folder")
  assert.equal(folderAsked(promptCreator, UNFILED_FOLDER), UNFILED_FOLDER, "every prompt in no folder")
  assert.equal(folderAsked(promptCreator, ""), "", "no folder filter at all")
  assert.equal(folderAsked(promptCreator, undefined), "", "the filter left out entirely")
})

test('"in a folder" and "no folder" can never be mistaken for a folder, whose id is 24 hex characters', () => {
  assert.notEqual(IN_ANY_FOLDER, UNFILED_FOLDER)
  for (const value of [IN_ANY_FOLDER, UNFILED_FOLDER]) assert.ok(!/^[0-9a-f]{24}$/.test(value), `${value} is not an id`)
})

test("a folder nobody could have picked is dropped, so the page shows every prompt instead of none", () => {
  for (const rubbish of ["in-folders", "IN-FOLDER", "../none", "6aac46349c1019d7aa40b7c", "<script>", " "]) {
    assert.equal(folderAsked(promptCreator, rubbish), "", `${JSON.stringify(rubbish)} is not a folder choice`)
  }
})

test("a tool without folders has no folder filter at all: asking it for one is refused, not quietly ignored", () => {
  assert.equal(folderAsked(connectionNote, ""), "", "an empty filter is what that page sends")
  assert.equal(folderAsked(connectionNote, undefined), "", "and leaving it out entirely is the same")
  for (const folder of [IN_ANY_FOLDER, UNFILED_FOLDER, "6aac46349c1019d7aa40b7c0"]) {
    const read = savedOutputsQuerySchema(connectionNote).safeParse({ page: "1", folder })
    assert.equal(read.success, false, `connection notes refuse ${folder}`)
  }
})
