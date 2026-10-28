#!/usr/bin/env node
/**
 * Writes the kind (individual or company) onto every client saved before Clients Management asked it.
 *
 * A client reads as **Individual** without one anyway (`clientKindOf` falls back, and the schema's
 * default only applies to new records), so nothing is broken until this runs. It is run so the field
 * is really there on every client: the owner asked for all of them to start as individuals and said
 * they would change the companies themselves, and a stored value is what the Type filter reads.
 *
 * Only clients that have **no** kind are touched, so a client already marked as a company is left
 * exactly as it is and running this again changes nothing. The same shape as `set-daily-task-doers.mjs`.
 *
 *   node scripts/set-client-kinds.mjs [--dry-run]
 *   node scripts/set-client-kinds.mjs --down     (takes the field off again)
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import mongoose from "mongoose"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")

const isDryRun = process.argv.includes("--dry-run")
const isDown = process.argv.includes("--down")

// The one value every client starts at; kept in step with DEFAULT_CLIENT_KIND in constants/clients.ts
const DEFAULT_KIND = "individual"
const KINDS = ["individual", "company"]

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
  const clients = mongoose.connection.db.collection("clients")

  const total = await clients.countDocuments()
  const counts = Object.fromEntries(await Promise.all(KINDS.map(async (id) => [id, await clients.countDocuments({ kind: id })])))
  // One condition, counted once: in MongoDB `$in: [null]` already matches a field that is not there,
  // so asking for "missing" and "null" separately counts the same client twice
  const unset = { $or: [{ kind: { $exists: false } }, { kind: { $in: [null, ""] } }] }
  const toSet = await clients.countDocuments(unset)

  console.log(`${total} client${total === 1 ? "" : "s"} in all`)
  console.log(`  with a kind: ${KINDS.map((id) => `${counts[id]} ${id}`).join(", ")}`)
  console.log(`  without one: ${toSet}`)

  if (isDown) {
    if (isDryRun) {
      console.log(`Dry run: would take the kind off all ${total} clients.`)
    } else {
      const { modifiedCount } = await clients.updateMany({ kind: { $exists: true } }, { $unset: { kind: "" } })
      console.log(`Took the kind off ${modifiedCount} client${modifiedCount === 1 ? "" : "s"}; they read as ${DEFAULT_KIND} again.`)
    }
    await mongoose.disconnect()
    return
  }

  if (toSet === 0) {
    console.log("Every client already says whether it is an individual or a company. Nothing to do.")
    await mongoose.disconnect()
    return
  }
  if (isDryRun) {
    console.log(`Dry run: would set ${toSet} client${toSet === 1 ? "" : "s"} to ${DEFAULT_KIND}. Nothing written.`)
    await mongoose.disconnect()
    return
  }

  const { modifiedCount } = await clients.updateMany(unset, { $set: { kind: DEFAULT_KIND } })
  const left = await clients.countDocuments(unset)
  console.log(`Set ${modifiedCount} client${modifiedCount === 1 ? "" : "s"} to ${DEFAULT_KIND}. ${left} left without one.`)
  await mongoose.disconnect()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
