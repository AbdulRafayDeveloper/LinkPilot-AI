// Records whose every stored attachment already is, for the attachment ownership check
// (src/services/attachmentOwners.ts, models/TaskImageOwner.ts). An image, a file or a recording is named
// by an id alone, so a record could be saved naming another account's id, show it, and delete it from
// storage. Saves now accept only ids recorded to the right account, which needs every attachment that
// already exists to be recorded once:
//
//   - an employee's plan images, under the employee's account (task-image);
//   - a client project item's images, files and voice note, under the project's owner (task-image,
//     project-file, voice-note), since the project's owner is who a save checks first;
//   - Post Image Creator's brand photos, under their settings' scope (brand-photo).
//
// Daily Tasks' images were recorded by scripts/own-daily-task-images.mjs. An id two owners both name is
// reported and left unrecorded, so neither can delete it. Ids already recorded are left as they are.
//
//   node scripts/own-attachments.mjs --dry-run   says what it would do
//   node scripts/own-attachments.mjs             does it
//   node scripts/own-attachments.mjs --down      removes exactly the rows it added
//
// What it adds is written to backups/ (git-ignored) first. Running it again changes nothing.

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs"
import { MongoClient } from "mongodb"

const BACKUP_PREFIX = "attachments-owned-"

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

const imagesOf = (record) => [...(record?.images ?? []), ...(record?.image?.assetId ? [record.image] : [])]

const client = new MongoClient(mongoUri())
try {
  await client.connect()
  const db = client.db()
  const owners = db.collection("task_images")

  if (down) {
    const files = existsSync("backups") ? readdirSync("backups").filter((name) => name.startsWith(BACKUP_PREFIX) && !name.endsWith(".restored.json")).sort() : []
    if (files.length === 0) fail(`No backups/${BACKUP_PREFIX}*.json to undo.`)
    const file = `backups/${files.at(-1)}`
    const backup = JSON.parse(readFileSync(file, "utf8"))
    const ids = backup.recorded.map((row) => row.assetId)
    if (!dryRun) {
      if (ids.length > 0) await owners.deleteMany({ assetId: { $in: ids } })
      renameSync(file, file.replace(/\.json$/, ".restored.json"))
    }
    console.log(`${dryRun ? "would remove" : "✓ removed"} ${ids.length} owner rows`)
  } else {
    // Every attachment that exists, with the owner a save would check it against
    const found = []
    const add = (assetId, ownerId, kind, contentType, where) => {
      if (assetId && ownerId) found.push({ assetId, ownerId, kind, contentType: contentType || "application/octet-stream", where })
    }

    for (const employee of await db.collection("employees").find({}, { projection: { ownerId: 1, planItems: 1 } }).toArray()) {
      for (const task of employee.planItems ?? []) for (const image of imagesOf(task)) add(image.assetId, employee.ownerId, "task-image", image.contentType, "employee plan")
    }
    for (const day of await db.collection("employee_plans").find({}, { projection: { ownerId: 1, items: 1 } }).toArray()) {
      for (const item of day.items ?? []) for (const image of imagesOf(item)) add(image.assetId, day.ownerId, "task-image", image.contentType, "employee plan day")
    }

    const projectOwner = new Map((await db.collection("client_projects").find({}, { projection: { ownerId: 1 } }).toArray()).map((project) => [String(project._id), project.ownerId]))
    for (const item of await db.collection("client_project_tasks").find({}, { projection: { ownerId: 1, projectId: 1, images: 1, files: 1, voiceNote: 1 } }).toArray()) {
      const owner = projectOwner.get(String(item.projectId)) || item.ownerId
      for (const image of item.images ?? []) add(image.assetId, owner, "task-image", image.contentType, "client project")
      for (const file of item.files ?? []) add(file.assetId, owner, "project-file", file.contentType, "client project")
      if (item.voiceNote?.assetId) add(item.voiceNote.assetId, owner, "voice-note", item.voiceNote.contentType, "client project")
    }

    for (const settings of await db.collection("post_image_settings").find({}, { projection: { scope: 1, assets: 1 } }).toArray()) {
      for (const asset of settings.assets ?? []) add(asset.id, settings.scope, "brand-photo", asset.contentType, "brand photo")
    }

    // One row per id: an id two owners both name is a conflict, left unrecorded
    const byId = new Map()
    const conflicts = new Set()
    for (const entry of found) {
      const seen = byId.get(entry.assetId)
      if (seen && (seen.ownerId !== entry.ownerId || seen.kind !== entry.kind)) conflicts.add(entry.assetId)
      else byId.set(entry.assetId, entry)
    }
    const alreadyRecorded = new Set((await owners.find({ assetId: { $in: [...byId.keys()] } }, { projection: { assetId: 1 } }).toArray()).map((row) => row.assetId))
    const toRecord = [...byId.values()].filter((entry) => !conflicts.has(entry.assetId) && !alreadyRecorded.has(entry.assetId))

    if (!dryRun) {
      mkdirSync("backups", { recursive: true })
      const takenAt = new Date().toISOString()
      writeFileSync(`backups/${BACKUP_PREFIX}${takenAt.replace(/[:.]/g, "-")}.json`, JSON.stringify({ takenAt, recorded: toRecord }, null, 2))
      await owners.createIndex({ assetId: 1 }, { unique: true })
      await owners.createIndex({ ownerId: 1 })
      const now = new Date()
      if (toRecord.length > 0) {
        await owners.insertMany(toRecord.map(({ assetId, ownerId, kind, contentType }) => ({ assetId, ownerId, kind, contentType, createdAt: now, updatedAt: now })))
      }
    }
    const counts = {}
    for (const entry of toRecord) counts[entry.where] = (counts[entry.where] ?? 0) + 1
    console.log(`${dryRun ? "would record" : "✓ recorded"} ${toRecord.length} attachments (${alreadyRecorded.size} already recorded)`)
    for (const [where, count] of Object.entries(counts)) console.log(`  ${where}: ${count}`)
    if (conflicts.size > 0) console.log(`! ${conflicts.size} ids are named by two owners and were left unrecorded: ${[...conflicts].join(", ")}`)
  }
} finally {
  await client.close()
}

