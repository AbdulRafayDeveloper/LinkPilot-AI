#!/usr/bin/env node
/**
 * Marks every daily task saved before repeating existed as **not repeating**.
 *
 * A task reads as not repeating without the field anyway (`repeats === true` is what the service
 * asks, and the schema's default only applies to new records), so nothing is broken until this
 * runs. It is run so the field is really there on every task, at the owner's request that they all
 * start as one-offs and that they mark the repeating ones themselves.
 *
 * Only tasks that have **no** flag are touched, so a task already repeating stays repeating and
 * running this again changes nothing. Same shape as `set-daily-task-blocked.mjs`.
 *
 *   node scripts/set-daily-task-repeats.mjs [--dry-run]
 *   node scripts/set-daily-task-repeats.mjs --down     (takes the field off again)
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import mongoose from "mongoose"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")

const isDryRun = process.argv.includes("--dry-run")
const isDown = process.argv.includes("--down")

function databaseUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI
  for (const name of [".env.local", ".env"]) {
    const path = join(root, name)
    if (!existsSync(path)) continue
    const line = readFileSync(path, "utf8")
      .split(/\r?\n/)
      .find((row) => row.startsWith("MONGODB_URI="))
    if (line) return line.slice("MONGODB_URI=".length).trim().replace(/^"|"$/g, "")
  }
  throw new Error("MONGODB_URI is not set: put it in .env.local or the environment.")
}

async function main() {
  await mongoose.connect(databaseUri(), { serverSelectionTimeoutMS: 20000 })
  const tasks = mongoose.connection.db.collection("daily_tasks")

  const total = await tasks.countDocuments()
  const repeating = await tasks.countDocuments({ repeats: true })
  const once = await tasks.countDocuments({ repeats: false })
  // One condition, counted once: `$in: [null]` already matches a field that is not there
  const unset = { $or: [{ repeats: { $exists: false } }, { repeats: { $in: [null, ""] } }] }
  const toSet = await tasks.countDocuments(unset)

  console.log(`${total} daily task${total === 1 ? "" : "s"} in all`)
  console.log(`  already marked: ${repeating} repeating, ${once} one-off`)
  console.log(`  without the flag: ${toSet}`)

  if (isDown) {
    if (isDryRun) {
      console.log(`Dry run: would take the flag off all ${total} tasks.`)
    } else {
      const { modifiedCount } = await tasks.updateMany({ repeats: { $exists: true } }, { $unset: { repeats: "" } })
      console.log(`Took the flag off ${modifiedCount} task${modifiedCount === 1 ? "" : "s"}; they read as not repeating again.`)
    }
    await mongoose.disconnect()
    return
  }

  if (toSet === 0) {
    console.log("Every task already says whether it repeats. Nothing to do.")
    await mongoose.disconnect()
    return
  }
  if (isDryRun) {
    console.log(`Dry run: would mark ${toSet} task${toSet === 1 ? "" : "s"} as not repeating. Nothing written.`)
    await mongoose.disconnect()
    return
  }

  const { modifiedCount } = await tasks.updateMany(unset, { $set: { repeats: false } })
  const left = await tasks.countDocuments(unset)
  console.log(`Marked ${modifiedCount} task${modifiedCount === 1 ? "" : "s"} as not repeating. ${left} left without the flag.`)
  await mongoose.disconnect()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
