#!/usr/bin/env node
/**
 * Writes a priority onto every daily task saved before priorities existed.
 *
 * A task reads as **Medium** without one anyway (`priorityOf` falls back, and the schema's default
 * only applies to new records), so nothing is broken until this runs. It is run so the field is
 * really there on every task: the owner asked for all of them to start at Medium and said they
 * would change the ones that matter themselves, and a stored value is what a query can sort or
 * filter on later without every older task being a special case.
 *
 * Only tasks that have **no** priority are touched, so a task already set to High or Low is left
 * exactly as it is and running this again changes nothing.
 *
 *   node scripts/set-daily-task-priorities.mjs [--dry-run]
 *   node scripts/set-daily-task-priorities.mjs --down     (takes the field off again)
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import mongoose from "mongoose"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")

const isDryRun = process.argv.includes("--dry-run")
const isDown = process.argv.includes("--down")

// The one value every task starts at; kept in step with constants/priorities.ts
const DEFAULT_PRIORITY = "medium"
const PRIORITIES = ["high", "medium", "low"]

function databaseUri() {
  for (const name of [".env.local", ".env"]) {
    const path = join(root, name)
    if (!existsSync(path)) continue
    const line = readFileSync(path, "utf8")
      .split(/\r?\n/)
      .find((row) => row.startsWith("MONGODB_URI="))
    if (line) return line.slice("MONGODB_URI=".length).trim().replace(/^"|"$/g, "")
  }
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI
  throw new Error("MONGODB_URI is not set: put it in .env.local or the environment.")
}

async function main() {
  await mongoose.connect(databaseUri(), { serverSelectionTimeoutMS: 20000 })
  const tasks = mongoose.connection.db.collection("daily_tasks")

  const total = await tasks.countDocuments()
  const counts = Object.fromEntries(await Promise.all(PRIORITIES.map(async (id) => [id, await tasks.countDocuments({ priority: id })])))
  // One condition, counted once: in MongoDB `$in: [null]` already matches a field that is not there,
  // so asking for "missing" and "null" separately counts the same task twice
  const unset = { $or: [{ priority: { $exists: false } }, { priority: { $in: [null, ""] } }] }
  const toSet = await tasks.countDocuments(unset)

  console.log(`${total} daily task${total === 1 ? "" : "s"} in all`)
  console.log(`  with a priority: ${PRIORITIES.map((id) => `${counts[id]} ${id}`).join(", ")}`)
  console.log(`  without one: ${toSet}`)

  if (isDown) {
    if (isDryRun) {
      console.log(`Dry run: would take the priority off all ${total} tasks.`)
    } else {
      const { modifiedCount } = await tasks.updateMany({ priority: { $exists: true } }, { $unset: { priority: "" } })
      console.log(`Took the priority off ${modifiedCount} task${modifiedCount === 1 ? "" : "s"}; they read as ${DEFAULT_PRIORITY} again.`)
    }
    await mongoose.disconnect()
    return
  }

  if (toSet === 0) {
    console.log("Every task already has a priority. Nothing to do.")
    await mongoose.disconnect()
    return
  }
  if (isDryRun) {
    console.log(`Dry run: would set ${toSet} task${toSet === 1 ? "" : "s"} to ${DEFAULT_PRIORITY}. Nothing written.`)
    await mongoose.disconnect()
    return
  }

  const { modifiedCount } = await tasks.updateMany(unset, { $set: { priority: DEFAULT_PRIORITY } })
  const left = await tasks.countDocuments(unset)
  console.log(`Set ${modifiedCount} task${modifiedCount === 1 ? "" : "s"} to ${DEFAULT_PRIORITY}. ${left} left without one.`)
  await mongoose.disconnect()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
