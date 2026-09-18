import test from "node:test"
import assert from "node:assert/strict"
import load from "./load.mjs"

const { moveMany } = load("lib/reorder.ts")

const ids = ["a", "b", "c", "d", "e"]
const set = (...picked) => new Set(picked)

test("one row on its own moves exactly as it did before", () => {
  assert.deepEqual(moveMany(ids, set("c"), 2, 0), ["c", "a", "b", "d", "e"])
  assert.deepEqual(moveMany(ids, set(), 0, 4), ["b", "c", "d", "e", "a"])
  assert.deepEqual(moveMany(ids, set("a"), 0, 2), ["b", "c", "a", "d", "e"])
})

test("dragging a row nobody picked moves that row alone, not the picked ones", () => {
  assert.deepEqual(moveMany(ids, set("a", "b"), 4, 0), ["e", "a", "b", "c", "d"])
})

test("two picked rows that are already side by side land together", () => {
  // a and b dragged down to where d is
  assert.deepEqual(moveMany(ids, set("a", "b"), 0, 3), ["c", "d", "a", "b", "e"])
})

test("picked rows that are far apart are brought together where they are dropped", () => {
  // a and e picked, a dragged to the end: both land there, in the order they had
  assert.deepEqual(moveMany(ids, set("a", "e"), 0, 4), ["b", "c", "d", "a", "e"])
  // a and e picked, e dragged to the top
  assert.deepEqual(moveMany(ids, set("a", "e"), 4, 0), ["a", "e", "b", "c", "d"])
})

test("the group keeps the order it had in the list, whichever one is dragged", () => {
  // c is dragged but b comes first in the list, so b stays first
  assert.deepEqual(moveMany(ids, set("b", "c"), 2, 4), ["a", "d", "e", "b", "c"])
})

test("every row stays exactly once, whatever moves", () => {
  for (const from of [0, 1, 2, 3, 4]) {
    for (const to of [0, 1, 2, 3, 4]) {
      for (const picked of [set("a"), set("a", "c"), set("b", "c", "d"), set("a", "e")]) {
        const result = moveMany(ids, picked, from, to)
        assert.equal(result.length, ids.length, `length changed for ${from}->${to}`)
        assert.deepEqual([...result].sort(), [...ids].sort(), `rows changed for ${from}->${to}`)
      }
    }
  }
})

test("the picked rows always end up next to each other", () => {
  const picked = set("a", "c", "e")
  for (const from of [0, 2, 4]) {
    for (const to of [0, 1, 2, 3, 4]) {
      const result = moveMany(ids, picked, from, to)
      const places = [...picked].map((id) => result.indexOf(id)).sort((x, y) => x - y)
      assert.equal(places[2] - places[0], 2, `not together for ${from}->${to}: ${result.join(",")}`)
    }
  }
})

test("picking everything and dragging changes nothing", () => {
  assert.deepEqual(moveMany(ids, set(...ids), 0, 4), ids)
  assert.deepEqual(moveMany(ids, set(...ids), 3, 1), ids)
})

test("a single-row list has nowhere to move to", () => {
  assert.deepEqual(moveMany(["a"], set("a"), 0, 0), ["a"])
})
