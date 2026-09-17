// Deletes the records that belong to no account: everything saved before accounts existed, and any
// record whose account has since been deleted.
//
//   node scripts/delete-unowned-records.mjs            dry run: counts only, changes nothing
//   node scripts/delete-unowned-records.mjs --apply    backs the records up, then deletes them
//
// Only collections whose model carries `ownerId` (src/models/owner.ts) are touched. Collections
// that have no owner by design (users, prompts, prompt_revisions, dummy_data, login_events and the
// shared post_image_settings) are never read for deletion, because "no owner" is normal there.
//
// Before deleting, every record is written to backups/ as Extended JSON (ObjectIds and dates kept),
// so anything removed can be put back with mongoimport or insertMany.

import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { BSON, MongoClient } from "mongodb"

// Every collection whose model has `ownerId: OWNER_ID`. Keep in step with src/models.
const OWNED_COLLECTIONS = [
  "connection_notes",
  "comment_writer_comments",
  "post_comment_replies",
  "follow_up_messages",
  "first_messages",
  "inmail_messages",
  "conversation_replies",
  "client_messages",
  "rewritten_messages",
  "created_prompts",
  "clients",
  "trending_searches",
  "daily_tasks",
  "quick_notes",
  "reference_content",
  "important_content",
  "meeting_plans",
  "meetings",
  "employees",
  "employee_plans",
  "important_files",
  "post_images",
]

// Their records point at objects in S3. Deleting the record alone would leave the object behind
// with nothing pointing at it, so these are reported and left for the app's own delete.
const STORED_IN_S3 = new Set(["important_files", "post_images"])

const BACKUP_DIR = "backups"

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

// MONGODB_URI from the environment, or from .env.local when the script is run in the project
function mongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI
  if (!existsSync(".env.local")) fail("MONGODB_URI is not set and there is no .env.local here. Run this from the project root.")
  const line = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.startsWith("MONGODB_URI="))
  if (!line) fail("MONGODB_URI is missing from .env.local.")
  return line.slice("MONGODB_URI=".length).trim().replace(/^["']|["']$/g, "")
}

const apply = process.argv.includes("--apply")
const client = new MongoClient(mongoUri())

try {
  await client.connect()
  const db = client.db()
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((entry) => entry.name))

  const accountIds = (await db.collection("users").find({}, { projection: { _id: 1 } }).toArray()).map((user) => String(user._id))
  // With no accounts every record would count as unowned; that is never what this script is for
  if (accountIds.length === 0) fail("There are no accounts in `users`, so every record would look unowned. Nothing was deleted.")

  // Missing, null, or pointing at an account that no longer exists ($nin also matches a missing field)
  const unowned = { ownerId: { $nin: accountIds } }

  console.log(`\nDatabase: ${db.databaseName} · accounts: ${accountIds.length} · mode: ${apply ? "APPLY" : "dry run"}\n`)

  const plan = []
  for (const name of OWNED_COLLECTIONS) {
    if (!existing.has(name)) continue
    const collection = db.collection(name)
    const [total, count] = await Promise.all([collection.countDocuments({}), collection.countDocuments(unowned)])
    const skipped = STORED_IN_S3.has(name) && count > 0
    plan.push({ name, total, count, skipped })
    const note = skipped ? "  ← skipped: its files are in S3, delete these from the app" : ""
    console.log(`${name.padEnd(26)} unowned ${String(count).padStart(5)} of ${String(total).padStart(5)}${note}`)
  }

  const toDelete = plan.filter((entry) => entry.count > 0 && !entry.skipped)
  const recordCount = toDelete.reduce((sum, entry) => sum + entry.count, 0)
  console.log(`\n${recordCount} record(s) in ${toDelete.length} collection(s) belong to no account.`)

  if (!apply) {
    console.log("Dry run: nothing was changed. Run again with --apply to back them up and delete them.\n")
    process.exit(0)
  }
  if (recordCount === 0) {
    console.log("Nothing to delete.\n")
    process.exit(0)
  }

  // 1. Back up exactly the records that will be deleted
  const backup = {}
  for (const { name } of toDelete) {
    backup[name] = await db.collection(name).find(unowned).toArray()
  }
  // The chunks of an unowned meeting go with it
  const meetingIds = (backup.meetings ?? []).map((meeting) => meeting._id)
  if (meetingIds.length > 0) backup.meeting_chunks = await db.collection("meeting_chunks").find({ meetingId: { $in: meetingIds } }).toArray()

  mkdirSync(BACKUP_DIR, { recursive: true })
  const file = join(BACKUP_DIR, `unowned-records-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
  writeFileSync(file, BSON.EJSON.stringify({ database: db.databaseName, createdAt: new Date(), collections: backup }, null, 2, { relaxed: false }))
  console.log(`\nBacked up to ${file}`)

  // 2. Delete by the ids that were backed up, still requiring no owner, so nothing else can be caught
  let deleted = 0
  for (const [name, records] of Object.entries(backup)) {
    if (records.length === 0) continue
    const ids = records.map((record) => record._id)
    const condition = name === "meeting_chunks" ? { _id: { $in: ids } } : { _id: { $in: ids }, ...unowned }
    const { deletedCount } = await db.collection(name).deleteMany(condition)
    deleted += deletedCount
    console.log(`${name.padEnd(26)} deleted ${deletedCount} of ${records.length}`)
  }

  // 3. Verify: nothing unowned is left, and every owned record is still there
  console.log("")
  for (const { name, total, count } of toDelete) {
    const [left, now] = await Promise.all([db.collection(name).countDocuments(unowned), db.collection(name).countDocuments({})])
    const ok = left === 0 && now === total - count
    console.log(`${ok ? "✓" : "✖"} ${name.padEnd(24)} unowned left ${left} · records ${total} → ${now}`)
    if (!ok) process.exitCode = 1
  }
  console.log(`\nDeleted ${deleted} record(s). Backup: ${file}\n`)
} finally {
  await client.close()
}
