#!/usr/bin/env node
/**
 * Writes **how often** every daily task repeats, and converts the flag the first version wrote.
 *
 * Repeating started as a plain boolean (`repeats: true` meant every day). The owner then asked for
 * weekly and monthly ones too, so a task now carries an interval (`repeat`: none, daily, weekly or
 * monthly, `src/lib/taskRepeat.ts`). A task reads correctly without the new field either way
 * (`repeatOf` falls back to the boolean, and then to "none"), so nothing is broken until this runs;
 * it is run so the field is really there on every task, at the owner's request that they all start
 * as one-offs and that they mark the repeating ones themselves.
 *
 *   - a task with `repeats: true` becomes `repeat: "daily"`, which is what that flag meant;
 *   - every other task without an interval becomes `repeat: "none"`;
 *   - the old boolean is taken off either way, so one task can never say two things.
 *
 * Only tasks that have **no** interval are touched, so one already set to weekly or monthly stays
 * as it is and running this again changes nothing. Same shape as `set-daily-task-blocked.mjs`.
 *
 *   node scripts/set-daily-task-repeat.mjs [--dry-run]
 *   node scripts/set-daily-task-repeat.mjs --down     (takes the interval off again)
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
  // One condition, counted once: `$in: [null]` already matches a field that is not there
  const noInterval = { $or: [{ repeat: { $exists: false } }, { repeat: { $in: [null, ""] } }] }
  const wasDaily = { ...noInterval, repeats: true }
  const counts = {}
  for (const interval of ["none", "daily", "weekly", "monthly"]) {
    counts[interval] = await tasks.countDocuments({ repeat: interval })
  }
  const toDaily = await tasks.countDocuments(wasDaily)
  const toSet = await tasks.countDocuments(noInterval)

  console.log(`${total} daily task${total === 1 ? "" : "s"} in all`)
  console.log(`  already set: ${Object.entries(counts).map(([interval, count]) => `${count} ${interval}`).join(", ")}`)
  console.log(`  without an interval: ${toSet}, of which ${toDaily} carry the old every-day flag`)

  if (isDown) {
    if (isDryRun) {
      console.log(`Dry run: would take the interval off all ${total} tasks.`)
    } else {
      const { modifiedCount } = await tasks.updateMany({ repeat: { $exists: true } }, { $unset: { repeat: "" } })
      console.log(`Took the interval off ${modifiedCount} task${modifiedCount === 1 ? "" : "s"}; they read as happening once again.`)
    }
    await mongoose.disconnect()
    return
  }

  if (toSet === 0) {
    console.log("Every task already says how often it repeats. Nothing to do.")
    await mongoose.disconnect()
    return
  }
  if (isDryRun) {
    console.log(`Dry run: would set ${toDaily} task${toDaily === 1 ? "" : "s"} to daily and ${toSet - toDaily} to once. Nothing written.`)
    await mongoose.disconnect()
    return
  }

  // The ones that said "every day" first, so the second pass cannot read them as one-offs
  const daily = await tasks.updateMany(wasDaily, { $set: { repeat: "daily" }, $unset: { repeats: "" } })
  const once = await tasks.updateMany(noInterval, { $set: { repeat: "none" }, $unset: { repeats: "" } })
  const left = await tasks.countDocuments(noInterval)
  console.log(`Set ${daily.modifiedCount} task${daily.modifiedCount === 1 ? "" : "s"} to daily and ${once.modifiedCount} to once. ${left} left without an interval.`)
  await mongoose.disconnect()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
