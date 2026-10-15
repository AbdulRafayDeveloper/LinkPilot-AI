#!/usr/bin/env node
/**
 * Marks every daily task saved before blocking existed as **not blocked**.
 *
 * A task reads as unblocked without the field anyway (`isBlocked === true` is what the service
 * asks, and the schema's default only applies to new records), so nothing is broken until this
 * runs. It is run so the field is really there on every task, at the owner's request that they all
 * start unblocked and that they block the ones that are held up themselves.
 *
 * Only tasks that have **no** flag are touched, so a task already blocked stays blocked and
 * running this again changes nothing. Same shape as `set-daily-task-doers.mjs`.
 *
 *   node scripts/set-daily-task-blocked.mjs [--dry-run]
 *   node scripts/set-daily-task-blocked.mjs --down     (takes the field off again)
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
  const blocked = await tasks.countDocuments({ isBlocked: true })
  const open = await tasks.countDocuments({ isBlocked: false })
  // One condition, counted once: `$in: [null]` already matches a field that is not there
  const unset = { $or: [{ isBlocked: { $exists: false } }, { isBlocked: { $in: [null, ""] } }] }
  const toSet = await tasks.countDocuments(unset)

  console.log(`${total} daily task${total === 1 ? "" : "s"} in all`)
  console.log(`  already marked: ${blocked} blocked, ${open} not blocked`)
  console.log(`  without the flag: ${toSet}`)

  if (isDown) {
    if (isDryRun) {
      console.log(`Dry run: would take the flag off all ${total} tasks.`)
    } else {
      const { modifiedCount } = await tasks.updateMany({ isBlocked: { $exists: true } }, { $unset: { isBlocked: "" } })
      console.log(`Took the flag off ${modifiedCount} task${modifiedCount === 1 ? "" : "s"}; they read as not blocked again.`)
    }
    await mongoose.disconnect()
    return
  }

  if (toSet === 0) {
    console.log("Every task already says whether it is blocked. Nothing to do.")
    await mongoose.disconnect()
    return
  }
  if (isDryRun) {
    console.log(`Dry run: would mark ${toSet} task${toSet === 1 ? "" : "s"} as not blocked. Nothing written.`)
    await mongoose.disconnect()
    return
  }

  const { modifiedCount } = await tasks.updateMany(unset, { $set: { isBlocked: false } })
  const left = await tasks.countDocuments(unset)
  console.log(`Marked ${modifiedCount} task${modifiedCount === 1 ? "" : "s"} as not blocked. ${left} left without the flag.`)
  await mongoose.disconnect()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
