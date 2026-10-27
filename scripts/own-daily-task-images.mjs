// Gives every daily task and every image on one an owner, for the image ownership check
// (src/services/taskImages.ts, models/TaskImageOwner.ts). An image used to be named by an id alone, so
// a task could be saved naming another account's image, see it, and delete it from storage when the
// task let it go. Saves now accept only images the task's account uploaded, which needs every image
// already on a task to be known as that account's:
//
//   1. a daily task with no owner is given to the account named by --email (the owner's, at their request);
//   2. every image a daily task names is recorded in `task_images` under that task's owner;
//   3. an image two accounts' tasks both name is reported and left unrecorded, so neither can delete it.
//
//   node scripts/own-daily-task-images.mjs --email rafay@linkpilot.ai --dry-run   says what it would do
//   node scripts/own-daily-task-images.mjs --email rafay@linkpilot.ai             does it
//   node scripts/own-daily-task-images.mjs --down                                 undoes it
//
// What it changes is written to backups/ (git-ignored) first, and --down undoes exactly that. Running it
// again changes nothing.

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs"
import { MongoClient, ObjectId } from "mongodb"

const BACKUP_PREFIX = "daily-task-images-owned-"

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

function mongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI
  if (!existsSync(".env.local")) fail("MONGODB_URI is not set and there is no .env.local here. Run this from the project root.")
  const line = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.startsWith("MONGODB_URI="))
  const uri = line?.slice("MONGODB_URI=".length).trim().replace(/^["']|["']$/g, "")
  if (!uri) fail("MONGODB_URI is missing from .env.local.")
  return uri
}

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const down = args.includes("--down")
const email = args.includes("--email") ? args[args.indexOf("--email") + 1]?.toLowerCase() : null

const client = new MongoClient(mongoUri())
try {
  await client.connect()
  const db = client.db()
  const tasks = db.collection("daily_tasks")
  const owners = db.collection("task_images")

  if (down) {
    const files = existsSync("backups") ? readdirSync("backups").filter((name) => name.startsWith(BACKUP_PREFIX) && !name.endsWith(".restored.json")).sort() : []
    if (files.length === 0) fail(`No backups/${BACKUP_PREFIX}*.json to undo.`)
    const file = `backups/${files.at(-1)}`
    const backup = JSON.parse(readFileSync(file, "utf8"))
    if (!dryRun) {
      if (backup.ownedTasks.length > 0) await tasks.updateMany({ _id: { $in: backup.ownedTasks.map((id) => new ObjectId(id)) } }, { $set: { ownerId: null } })
      if (backup.recordedImages.length > 0) await owners.deleteMany({ assetId: { $in: backup.recordedImages } })
      renameSync(file, file.replace(/\.json$/, ".restored.json"))
    }
    console.log(`${dryRun ? "would undo" : "✓ undid"}: ${backup.ownedTasks.length} tasks given back no owner, ${backup.recordedImages.length} image rows removed`)
  } else {
    if (!email) fail("Name the account ownerless tasks go to: --email <address>.")
    const account = await db.collection("users").findOne({ email })
    if (!account) fail(`No account has the email ${email}.`)
    const ownerId = String(account._id)

    // 1. Tasks with no owner
    const ownerless = await tasks.find({ $or: [{ ownerId: { $exists: false } }, { ownerId: null }, { ownerId: "" }] }, { projection: { _id: 1 } }).toArray()

    // 2 and 3. Every image a task names, with the owner it will have once step 1 is done
    const ownerOf = new Map()
    const conflicts = new Set()
    const named = await tasks.find({ $or: [{ "images.0": { $exists: true } }, { "image.assetId": { $exists: true } }] }, { projection: { ownerId: 1, image: 1, images: 1 } }).toArray()
    for (const task of named) {
      const taskOwner = task.ownerId || ownerId
      for (const image of [...(task.images ?? []), ...(task.image?.assetId ? [task.image] : [])]) {
        const seen = ownerOf.get(image.assetId)
        if (seen && seen.ownerId !== taskOwner) conflicts.add(image.assetId)
        else ownerOf.set(image.assetId, { ownerId: taskOwner, contentType: image.contentType })
      }
    }
    const alreadyRecorded = new Set((await owners.find({ assetId: { $in: [...ownerOf.keys()] } }, { projection: { assetId: 1 } }).toArray()).map((row) => row.assetId))
    const toRecord = [...ownerOf].filter(([assetId]) => !conflicts.has(assetId) && !alreadyRecorded.has(assetId))

    if (!dryRun) {
      mkdirSync("backups", { recursive: true })
      const takenAt = new Date().toISOString()
      writeFileSync(
        `backups/${BACKUP_PREFIX}${takenAt.replace(/[:.]/g, "-")}.json`,
        JSON.stringify({ takenAt, ownerId, ownedTasks: ownerless.map((task) => String(task._id)), recordedImages: toRecord.map(([assetId]) => assetId) }, null, 2)
      )
      await owners.createIndex({ assetId: 1 }, { unique: true })
      await owners.createIndex({ ownerId: 1 })
      if (ownerless.length > 0) await tasks.updateMany({ _id: { $in: ownerless.map((task) => task._id) } }, { $set: { ownerId } })
      const now = new Date()
      if (toRecord.length > 0) {
        await owners.insertMany(toRecord.map(([assetId, row]) => ({ assetId, ownerId: row.ownerId, contentType: row.contentType, createdAt: now, updatedAt: now })))
      }
    }
    const verb = dryRun ? "would" : "✓"
    console.log(`${verb} give ${ownerless.length} ownerless daily tasks to ${email}`)
    console.log(`${verb} record ${toRecord.length} images (${alreadyRecorded.size} already recorded, ${named.length} tasks carry images)`)
    if (conflicts.size > 0) console.log(`! ${conflicts.size} images are named by tasks of two accounts and were left unrecorded: ${[...conflicts].join(", ")}`)
  }
} finally {
  await client.close()
}
