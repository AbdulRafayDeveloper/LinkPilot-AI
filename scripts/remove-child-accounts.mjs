#!/usr/bin/env node
/**
 * Removes child accounts from the database, now that the concept is gone from the app.
 *
 * A child account signed in with its own email and worked inside its parent's workspace. Everything
 * it saved in a tool was stamped with the parent's id, so **it is the parent's already and is not
 * touched here**. What goes is only the child itself:
 *
 *   - the child's `users` document (which ends its sign-in at once);
 *   - what was the child's own rather than the workspace's: its My AI Profile entries and their
 *     search vectors (`profile_entries`, `profile_vectors`, stamped with the child's own id), and its
 *     profile photo in storage when it had one;
 *   - `parentId` on every other account, which nothing reads any more.
 *
 * Its sign-in history stays in `login_events` and its AI calls in `ai_usage`, like any deleted
 * account's, since those are the record of what happened. Every document removed is written to
 * `backups/` first (Extended JSON, git-ignored), and `--down` puts the documents back from the
 * newest backup. A photo removed from storage cannot be put back by `--down`.
 *
 *   node scripts/remove-child-accounts.mjs --dry-run
 *   node scripts/remove-child-accounts.mjs
 *   node scripts/remove-child-accounts.mjs --down
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import mongoose from "mongoose"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")
const backups = join(root, "backups")
const BACKUP_PREFIX = "child-accounts-"

const isDryRun = process.argv.includes("--dry-run")
const isDown = process.argv.includes("--down")

// The collections that hold what was the child's own, keyed by its own id
const OWN_COLLECTIONS = ["profile_entries", "profile_vectors"]
// Kept in step with lib/accountPhoto.ts
const PHOTO_PREFIX = "LinkPilot/account-photos"

function envValue(name) {
  for (const file of [".env.local", ".env"]) {
    const path = join(root, file)
    if (!existsSync(path)) continue
    const line = readFileSync(path, "utf8")
      .split(/\r?\n/)
      .find((row) => row.startsWith(`${name}=`))
    if (line) return line.slice(name.length + 1).trim().replace(/^"|"$/g, "")
  }
  return process.env[name] || ""
}

function databaseUri() {
  const uri = envValue("MONGODB_URI")
  if (!uri) throw new Error("MONGODB_URI is not set: put it in .env.local or the environment.")
  return uri
}

const { EJSON } = mongoose.mongo.BSON

async function storageClient() {
  const region = envValue("AWS_REGION")
  const accessKeyId = envValue("AWS_ACCESS_KEY_ID")
  const secretAccessKey = envValue("AWS_SECRET_ACCESS_KEY")
  const bucket = envValue("AWS_S3_BUCKET_NAME")
  if (!region || !accessKeyId || !secretAccessKey || !bucket) return null
  const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3")
  const client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } })
  return { remove: (key) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })) }
}

async function restore(db) {
  const files = existsSync(backups) ? readdirSync(backups).filter((name) => name.startsWith(BACKUP_PREFIX)).sort() : []
  if (files.length === 0) throw new Error("No child accounts backup to restore from in backups/.")
  const latest = files.at(-1)
  const saved = EJSON.parse(readFileSync(join(backups, latest), "utf8"))
  console.log(`Restoring from ${latest}: ${saved.users.length} account(s)`)
  if (isDryRun) return
  for (const user of saved.users) await db.collection("users").replaceOne({ _id: user._id }, user, { upsert: true })
  for (const name of OWN_COLLECTIONS) {
    for (const doc of saved[name] ?? []) await db.collection(name).replaceOne({ _id: doc._id }, doc, { upsert: true })
  }
  console.log("Restored. Photos removed from storage are not restored.")
}

async function main() {
  await mongoose.connect(databaseUri(), { serverSelectionTimeoutMS: 20000 })
  const db = mongoose.connection.db
  if (isDown) return restore(db)

  const users = db.collection("users")
  const children = await users.find({ parentId: { $nin: [null, ""], $exists: true } }).toArray()
  const childIds = children.map((child) => String(child._id))
  const own = Object.fromEntries(
    await Promise.all(OWN_COLLECTIONS.map(async (name) => [name, childIds.length ? await db.collection(name).find({ ownerId: { $in: childIds } }).toArray() : []]))
  )
  const withField = await users.countDocuments({ parentId: { $exists: true } })

  console.log(`Child accounts: ${children.length}`)
  for (const child of children) console.log(`  ${child.email} (${child.name}), parent ${child.parentId}${child.photoFile ? ", has a photo" : ""}`)
  for (const name of OWN_COLLECTIONS) console.log(`Their ${name}: ${own[name].length}`)
  console.log(`Accounts carrying a parentId field: ${withField}`)
  if (isDryRun) return console.log("Dry run: nothing changed.")

  if (children.length > 0) {
    mkdirSync(backups, { recursive: true })
    const file = join(backups, `${BACKUP_PREFIX}${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
    writeFileSync(file, EJSON.stringify({ users: children, ...own }, null, 2, { relaxed: false }))
    console.log(`Backed up to ${file}`)

    const storage = await storageClient()
    for (const child of children.filter((entry) => entry.photoFile)) {
      const key = `${PHOTO_PREFIX}/${child._id}/${child.photoFile}`
      if (!storage) {
        console.warn(`Storage is not configured here, so the photo ${key} is left in the bucket`)
        continue
      }
      await storage.remove(key).catch((error) => console.warn(`Could not remove ${key}: ${error.message}`))
    }
    for (const name of OWN_COLLECTIONS) await db.collection(name).deleteMany({ ownerId: { $in: childIds } })
    const { deletedCount } = await users.deleteMany({ _id: { $in: children.map((child) => child._id) } })
    console.log(`Deleted ${deletedCount} child account(s)`)
  }

  const { modifiedCount } = await users.updateMany({ parentId: { $exists: true } }, { $unset: { parentId: "" } })
  console.log(`Took parentId off ${modifiedCount} account(s)`)
  // The index on parentId served only the child lookups
  const indexes = await users.indexes()
  for (const index of indexes.filter((entry) => entry.key && Object.keys(entry.key).length === 1 && entry.key.parentId)) {
    await users.dropIndex(index.name)
    console.log(`Dropped index ${index.name}`)
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
