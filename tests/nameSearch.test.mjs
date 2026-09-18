import test from "node:test"
import assert from "node:assert/strict"
import load from "./load.mjs"

const { matchesWords, filterByWords } = load("lib/nameSearch.ts")

test("a blank query matches everything, so a search box opens on the whole list", () => {
  assert.equal(matchesWords("Client onboarding", ""), true)
  assert.equal(matchesWords("Client onboarding", "   "), true)
})

test("every word typed must appear, in any order and whatever the case", () => {
  assert.equal(matchesWords("Client onboarding steps", "client"), true)
  assert.equal(matchesWords("Client onboarding steps", "CLIENT"), true)
  assert.equal(matchesWords("Client onboarding steps", "steps client"), true)
  assert.equal(matchesWords("Client onboarding steps", "client billing"), false)
})

test("a part of a word matches, so a folder is found before it is fully typed", () => {
  assert.equal(matchesWords("Onboarding", "onb"), true)
  assert.equal(matchesWords("Onboarding", "board"), true)
})

test("extra spaces around and between words are ignored", () => {
  assert.equal(matchesWords("Client onboarding", "  client   onboarding  "), true)
})

const FOLDERS = [
  { id: "1", label: "Client work (4)", searchText: "Client work" },
  { id: "2", label: "Research (12)", searchText: "Research" },
  { id: "3", label: "Cold outreach (4)", searchText: "Cold outreach" },
]
const textOf = (option) => option.searchText ?? option.label

test("the list narrows to what matches and keeps the order it was given", () => {
  assert.deepEqual(
    filterByWords(FOLDERS, "co", textOf).map((option) => option.id),
    ["3"]
  )
  assert.deepEqual(
    filterByWords(FOLDERS, "outreach cold", textOf).map((option) => option.id),
    ["3"]
  )
  // A letter inside a word counts, so "c" still finds "Resear(c)h"
  assert.deepEqual(
    filterByWords(FOLDERS, "c", textOf).map((option) => option.id),
    ["1", "2", "3"]
  )
})

test("a query matching nothing gives an empty list rather than everything", () => {
  assert.deepEqual(filterByWords(FOLDERS, "invoices", textOf), [])
})

test("an empty query gives the whole list back", () => {
  assert.equal(filterByWords(FOLDERS, "", textOf).length, FOLDERS.length)
})

test("the count beside a folder is not searched, since it is not part of the name", () => {
  // Both "Client work" and "Cold outreach" read "(4)"; typing 4 must not find either
  assert.deepEqual(filterByWords(FOLDERS, "4", textOf), [])
  // Without its own search text, a choice is matched on what it reads
  assert.deepEqual(
    filterByWords([{ id: "all", label: "All folders" }], "folders", textOf).map((option) => option.id),
    ["all"]
  )
})
