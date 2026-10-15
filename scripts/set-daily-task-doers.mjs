#!/usr/bin/env node
/**
 * Writes who does it onto every daily task saved before that choice existed.
 *
 * A task reads as **Me** without one anyway (`doerOf` falls back, and the schema's default only
 * applies to new records), so nothing is broken until this runs. It is run so the field is really
 * there on every task: the owner asked for all of them to start as their own and said they would
 * mark the employee's ones themselves, and a stored value is what the list's filter reads without
 * every older task being a special case.
 *
 * Only tasks that have **no** doer are touched, so a task already marked as an employee's is left
 * exactly as it is and running this again changes nothing. It is the same shape, and the same
 * reasoning, as `set-daily-task-priorities.mjs`.
 *
 *   node scripts/set-daily-task-doers.mjs [--dry-run]
 *   node scripts/set-daily-task-doers.mjs --down     (takes the field off again)
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import mongoose from "mongoose"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")

const isDryRun = process.argv.includes("--dry-run")
const isDown = process.argv.includes("--down")

// The one value every task starts at; kept in step with constants/taskDoers.ts
const DEFAULT_DOER = "me"
const DOERS = ["me", "employee"]

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
  const counts = Object.fromEntries(await Promise.all(DOERS.map(async (id) => [id, await tasks.countDocuments({ doer: id })])))
  // One condition, counted once: in MongoDB `$in: [null]` already matches a field that is not there,
  // so asking for "missing" and "null" separately counts the same task twice
  const unset = { $or: [{ doer: { $exists: false } }, { doer: { $in: [null, ""] } }] }
  const toSet = await tasks.countDocuments(unset)

  console.log(`${total} daily task${total === 1 ? "" : "s"} in all`)
  console.log(`  with a doer: ${DOERS.map((id) => `${counts[id]} ${id}`).join(", ")}`)
  console.log(`  without one: ${toSet}`)

  if (isDown) {
    if (isDryRun) {
      console.log(`Dry run: would take the doer off all ${total} tasks.`)
    } else {
      const { modifiedCount } = await tasks.updateMany({ doer: { $exists: true } }, { $unset: { doer: "" } })
      console.log(`Took the doer off ${modifiedCount} task${modifiedCount === 1 ? "" : "s"}; they read as ${DEFAULT_DOER} again.`)
    }
    await mongoose.disconnect()
    return
  }

  if (toSet === 0) {
    console.log("Every task already says who does it. Nothing to do.")
    await mongoose.disconnect()
    return
  }
  if (isDryRun) {
    console.log(`Dry run: would set ${toSet} task${toSet === 1 ? "" : "s"} to ${DEFAULT_DOER}. Nothing written.`)
    await mongoose.disconnect()
    return
  }

  const { modifiedCount } = await tasks.updateMany(unset, { $set: { doer: DEFAULT_DOER } })
  const left = await tasks.countDocuments(unset)
  console.log(`Set ${modifiedCount} task${modifiedCount === 1 ? "" : "s"} to ${DEFAULT_DOER}. ${left} left without one.`)
  await mongoose.disconnect()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
