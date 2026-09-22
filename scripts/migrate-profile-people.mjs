// Moves Comment Writer's Profile Scheduler (`profile_schedules`) from "a LinkedIn link and its days" to
// "a person": name, role, location, sector, types (several allowed) and a link that may still be missing.
//
//   node scripts/migrate-profile-people.mjs up       [--dry-run]
//   node scripts/migrate-profile-people.mjs down     [--dry-run]
//
// up    gives every record the new fields, empty (name, role, location, sector "", types []), and
//       replaces the unique index on { ownerId, profileUrl } with one that only covers records that have
//       a link, so any number of people can wait for theirs while a link is still kept once per account.
//       No record loses anything; running it twice changes nothing.
// down  puts the collection back exactly as the code before this expected it: the new fields are
//       removed and the old unique index comes back. It refuses while any record has no link, since the
//       old code can't hold one: give those people a link, or delete them, first. It never deletes.
//
// MONGODB_URI comes from the environment or the project's .env.local.

import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { MongoClient } from "mongodb"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const OLD_INDEX = "ownerId_1_profileUrl_1"
const NEW_INDEX = "ownerId_1_profileUrl_1_linked"
const TYPES_INDEX = "ownerId_1_types_1"
const FIELDS = { name: "", role: "", location: "", sector: "", types: [] }

const fail = (message) => {
  console.error(`\n${message}\n`)
  process.exit(1)
}

function mongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI
  const envFile = path.join(root, ".env.local")
  if (!existsSync(envFile)) fail("MONGODB_URI is not set and there is no .env.local in the project.")
  const line = readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.startsWith("MONGODB_URI="))
  const uri = line?.slice("MONGODB_URI=".length).trim().replace(/^["']|["']$/g, "")
  if (!uri) fail("MONGODB_URI is missing from .env.local.")
  return uri
}

const [direction, ...flags] = process.argv.slice(2)
if (direction !== "up" && direction !== "down") fail("Say up or down: node scripts/migrate-profile-people.mjs up")
const dryRun = flags.includes("--dry-run")
const say = (message) => console.log(`${dryRun ? "[dry run] " : ""}${message}`)

const client = await MongoClient.connect(mongoUri(), { serverSelectionTimeoutMS: 20000 })
try {
  const schedules = client.db().collection("profile_schedules")
  const names = (await schedules.indexes()).map((index) => index.name)

  if (direction === "up") {
    for (const [field, empty] of Object.entries(FIELDS)) {
      const missing = await schedules.countDocuments({ [field]: { $exists: false } })
      say(`${field}: ${missing} records given ${JSON.stringify(empty)}`)
      if (!dryRun && missing) await schedules.updateMany({ [field]: { $exists: false } }, { $set: { [field]: empty } })
    }
    // The new index is built before the old one goes, so a link is never unguarded in between
    if (!names.includes(NEW_INDEX)) {
      say(`index ${NEW_INDEX}: created (unique, records with a link only)`)
      if (!dryRun) {
        await schedules.createIndex({ ownerId: 1, profileUrl: 1 }, { unique: true, name: NEW_INDEX, partialFilterExpression: { profileUrl: { $type: "string" } } })
      }
    }
    if (names.includes(OLD_INDEX)) {
      say(`index ${OLD_INDEX}: dropped (it required every record to have a link)`)
      if (!dryRun) await schedules.dropIndex(OLD_INDEX)
    }
    if (!names.includes(TYPES_INDEX)) {
      say(`index ${TYPES_INDEX}: created (the type filter)`)
      if (!dryRun) await schedules.createIndex({ ownerId: 1, types: 1 }, { name: TYPES_INDEX })
    }
  } else {
    const linkless = await schedules.find({ $or: [{ profileUrl: null }, { profileUrl: { $exists: false } }] }, { projection: { name: 1 } }).toArray()
    if (linkless.length) {
      fail(`${linkless.length} people have no LinkedIn link, which the old code can't hold. Add their links or delete them first:\n  ${linkless.map((person) => person.name || person._id).join("\n  ")}`)
    }
    if (names.includes(TYPES_INDEX)) {
      say(`index ${TYPES_INDEX}: dropped`)
      if (!dryRun) await schedules.dropIndex(TYPES_INDEX)
    }
    if (!names.includes(OLD_INDEX)) {
      say(`index ${OLD_INDEX}: created (unique)`)
      if (!dryRun) await schedules.createIndex({ ownerId: 1, profileUrl: 1 }, { unique: true, name: OLD_INDEX })
    }
    if (names.includes(NEW_INDEX)) {
      say(`index ${NEW_INDEX}: dropped`)
      if (!dryRun) await schedules.dropIndex(NEW_INDEX)
    }
    const unset = Object.fromEntries(Object.keys(FIELDS).map((field) => [field, ""]))
    const carrying = await schedules.countDocuments({ $or: Object.keys(FIELDS).map((field) => ({ [field]: { $exists: true } })) })
    say(`${Object.keys(FIELDS).join(", ")}: removed from ${carrying} records`)
    if (!dryRun && carrying) await schedules.updateMany({}, { $unset: unset })
  }
  say(`Done (${direction}).`)
} finally {
  await client.close()
}
