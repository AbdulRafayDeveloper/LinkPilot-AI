#!/usr/bin/env node
/**
 * Moves the Daily Tasks narrowing out of its own field and into the one every page's filters are
 * kept in.
 *
 * Daily Tasks kept its filters in `dailyTaskFilters` on `users` for a day, with a route and a
 * service of its own. Every page keeps its filters now (`constants/savedFilters.ts`), under
 * `viewFilters.<view>`, so this carries whatever an account was last narrowed to over to
 * `viewFilters["daily-tasks"]` and takes the old field off.
 *
 * Nothing is broken until it runs: an account with no `viewFilters` entry simply opens Daily Tasks
 * showing everything, which is what a fresh account does. It is run so no account is left carrying
 * a field nothing reads, and so the narrowing the owner put on yesterday is still on.
 *
 * Only the filters that are really on are carried (an empty choice **is** how a filter says it is
 * off), and an account that already has a `viewFilters["daily-tasks"]` entry is left exactly as it
 * is, so running this again changes nothing.
 *
 *   node scripts/move-task-filters.mjs [--dry-run]
 *   node scripts/move-task-filters.mjs --down     (puts the old field back from viewFilters)
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import mongoose from "mongoose"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")

const isDryRun = process.argv.includes("--dry-run")
const isDown = process.argv.includes("--down")

// The page, and the four choices it narrows on; kept in step with constants/savedFilters.ts
const VIEW = "daily-tasks"
const KEYS = ["priority", "doer", "blocked", "done"]

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

// Only what is really on, as the shared rules keep it: a string with something in it
const filtersOf = (stored) =>
  Object.fromEntries(
    KEYS.map((key) => [key, stored?.[key]]).filter(([, value]) => typeof value === "string" && value.trim().length > 0)
  )

async function main() {
  await mongoose.connect(databaseUri(), { serverSelectionTimeoutMS: 20000 })
  const users = mongoose.connection.db.collection("users")

  if (isDown) {
    const accounts = await users.find({ [`viewFilters.${VIEW}`]: { $exists: true } }, { projection: { viewFilters: 1 } }).toArray()
    console.log(`${accounts.length} account${accounts.length === 1 ? "" : "s"} ${accounts.length === 1 ? "carries" : "carry"} Daily Tasks filters`)
    if (isDryRun) {
      console.log("Dry run: would put the old dailyTaskFilters field back on each. Nothing written.")
      await mongoose.disconnect()
      return
    }
    let moved = 0
    for (const account of accounts) {
      const kept = filtersOf(account.viewFilters?.[VIEW])
      const old = Object.fromEntries(KEYS.map((key) => [key, kept[key] ?? ""]))
      await users.updateOne({ _id: account._id }, { $set: { dailyTaskFilters: old }, $unset: { [`viewFilters.${VIEW}`]: "" } })
      moved += 1
    }
    console.log(`Put the old field back on ${moved} account${moved === 1 ? "" : "s"}.`)
    await mongoose.disconnect()
    return
  }

  const accounts = await users
    .find({ dailyTaskFilters: { $exists: true } }, { projection: { email: 1, dailyTaskFilters: 1, viewFilters: 1 } })
    .toArray()
  const narrowed = accounts.filter((account) => Object.keys(filtersOf(account.dailyTaskFilters)).length > 0)
  console.log(`${accounts.length} account${accounts.length === 1 ? "" : "s"} carry the old field, ${narrowed.length} with a filter really on`)

  if (accounts.length === 0) {
    console.log("No account carries it. Nothing to do.")
    await mongoose.disconnect()
    return
  }
  if (isDryRun) {
    for (const account of narrowed) console.log(`  ${account.email}: ${JSON.stringify(filtersOf(account.dailyTaskFilters))}`)
    console.log(`Dry run: would carry ${narrowed.length} narrowing over and take the old field off ${accounts.length}. Nothing written.`)
    await mongoose.disconnect()
    return
  }

  let carried = 0
  for (const account of accounts) {
    const kept = filtersOf(account.dailyTaskFilters)
    // An account already keeping this page's filters is left exactly as it is
    const already = account.viewFilters?.[VIEW] !== undefined
    const update = { $unset: { dailyTaskFilters: "" } }
    if (!already && Object.keys(kept).length > 0) {
      update.$set = { [`viewFilters.${VIEW}`]: kept }
      carried += 1
    }
    await users.updateOne({ _id: account._id }, update)
  }
  const left = await users.countDocuments({ dailyTaskFilters: { $exists: true } })
  console.log(`Carried ${carried} narrowing${carried === 1 ? "" : "s"} over and took the old field off ${accounts.length - left}. ${left} left carrying it.`)
  await mongoose.disconnect()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
