import test from "node:test"
import assert from "node:assert/strict"
import load from "./load.mjs"

const { folderDropId, folderFromDropId, UNFILED_DROP } = load("lib/folderDrop.ts")

test("a folder's drop target is named after the folder, and reads back as its id", () => {
  assert.equal(folderFromDropId(folderDropId("6aabfcfcd04f6e7f3d12ca17")), "6aabfcfcd04f6e7f3d12ca17")
})

test("dropping on No folder takes the record out of its folder", () => {
  assert.equal(folderFromDropId(folderDropId(UNFILED_DROP)), null)
})

test("anything that isn't a folder target is not a place to file a record", () => {
  // undefined, not null: null already means "no folder", which is a real place to drop
  assert.equal(folderFromDropId("some-row-id"), undefined)
  assert.equal(folderFromDropId(""), undefined)
})
