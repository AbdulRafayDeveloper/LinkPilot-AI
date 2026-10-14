#!/usr/bin/env node
/**
 * Gives every client project item that was saved before numbering its number.
 *
 * An item's number is its name on its tab for good ("AA Change 12"), so it has to be given once to
 * what is already there: per project and per tab, in the order the items are shown (their position,
 * then when they were added), starting at 1. Items added from now on take their number as they are
 * created, one past the highest ever given out on that tab.
 *
 *   node scripts/number-project-items.mjs [--dry-run]
 *   node scripts/number-project-items.mjs --down     (takes the numbers off again)
 *
 * It only ever writes `number`, and only on rows that have none, so running it twice changes
 * nothing and no other field of any item is touched.
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import mongoose from "mongoose"

const dryRun = process.argv.includes("--dry-run")
const down = process.argv.includes("--down")

// The same way every other script here finds it: the app's own .env.local, then the environment
function databaseUri() {
  for (const name of [".env.local", ".env"]) {
    const path = join(process.cwd(), name)
    if (!existsSync(path)) continue
    const line = readFileSync(path, "utf8")
      .split("\n")
      .find((row) => row.startsWith("MONGODB_URI="))
    if (line) return line.slice("MONGODB_URI=".length).trim().replace(/^"|"$/g, "")
  }
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI
  throw new Error("MONGODB_URI is not set: put it in .env.local or the environment.")
}

const uri = databaseUri()

const run = async () => {
  await mongoose.connect(uri, { dbName: "LinkPilot" })
  const items = mongoose.connection.db.collection("client_project_tasks")

  if (down) {
    const { modifiedCount } = dryRun
      ? { modifiedCount: await items.countDocuments({ number: { $gt: 0 } }) }
      : await items.updateMany({}, { $unset: { number: "" } })
    console.log(`${dryRun ? "Would take" : "Took"} the number off ${modifiedCount} item(s).`)
    await mongoose.disconnect()
    return
  }

  // One tab of one project at a time, in the order its items are shown
  const groups = await items
    .aggregate([
      { $match: { $or: [{ number: { $exists: false } }, { number: { $lte: 0 } }] } },
      { $group: { _id: { projectId: "$projectId", kind: "$kind" } } },
    ])
    .toArray()

  let numbered = 0
  for (const group of groups) {
    const { projectId, kind } = group._id
    const tab = { projectId, kind: kind ?? { $in: [null, "change"] } }
    const rows = await items
      .find(tab)
      .project({ _id: 1, number: 1 })
      .sort({ position: 1, createdAt: 1, _id: 1 })
      .toArray()
    // Whatever numbers are already out on this tab stay; the rest take the ones after them
    let next = rows.reduce((highest, row) => Math.max(highest, row.number ?? 0), 0)
    const writes = []
    for (const row of rows) {
      if (row.number > 0) continue
      next += 1
      writes.push({ updateOne: { filter: { _id: row._id }, update: { $set: { number: next } } } })
    }
    if (writes.length === 0) continue
    numbered += writes.length
    if (!dryRun) await items.bulkWrite(writes)
    console.log(`${dryRun ? "Would number" : "Numbered"} ${writes.length} item(s) on ${kind ?? "change"} of project ${projectId}`)
  }

  console.log(`\n${dryRun ? "Would number" : "Numbered"} ${numbered} item(s) across ${groups.length} tab(s).`)
  await mongoose.disconnect()
}

run().catch(async (error) => {
  console.error("Numbering failed:", error instanceof Error ? error.message : error)
  try {
    await mongoose.disconnect()
  } catch {}
  process.exit(1)
})
