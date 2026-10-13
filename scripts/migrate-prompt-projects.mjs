#!/usr/bin/env node
/**
 * Retires the Projects module's own list of projects.
 *
 * Prompt Creator used to keep its own projects in `prompt_projects`, managed on a `/projects` page.
 * At the owner's request a prompt is now written for a **client's** project (`client_projects`,
 * Clients Management), so that collection and that page are gone. This moves what was in it:
 *
 *   up    Every old project is matched to a client project of the same name (whatever the case,
 *         same account). Where one is found, the prompts written for the old project are repointed
 *         at it, its instructions are copied over when the client project has none, and its folder
 *         is linked. Where none is found, those prompts go back to **no project** and keep the
 *         folder they are filed in, so nothing the user wrote moves or disappears. Every old
 *         document is written to backups/ first, then deleted.
 *
 *   down  Puts the documents in backups/ back, with their ids, so the old page's data is recoverable
 *         if this is ever reverted. It does not repoint prompts: `up` records what it changed in the
 *         same file, and the report says what to expect.
 *
 * Nothing here is destructive without a backup, and `--dry-run` only reports.
 *
 *   node scripts/migrate-prompt-projects.mjs up [--dry-run]
 *   node scripts/migrate-prompt-projects.mjs down [--file backups/<name>.json]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import mongoose from "mongoose"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")
const BACKUPS = join(root, "backups")

const direction = process.argv[2]
const isDryRun = process.argv.includes("--dry-run")
const fileArg = process.argv.indexOf("--file")
const chosenFile = fileArg === -1 ? null : process.argv[fileArg + 1]

if (direction !== "up" && direction !== "down") {
  console.error("Usage: node scripts/migrate-prompt-projects.mjs up|down [--dry-run] [--file <backup>]")
  process.exit(1)
}

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

// Two projects called "Clinic app" and "clinic app" are the same project to a reader
const sameName = (name) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")

async function up(db) {
  const old = await db.collection("prompt_projects").find({}).toArray()
  if (old.length === 0) {
    console.log("Nothing to move: prompt_projects is already empty.")
    return
  }
  console.log(`${old.length} project${old.length === 1 ? "" : "s"} in prompt_projects.`)

  const changes = []
  for (const project of old) {
    const id = String(project._id)
    const owner = project.ownerId ?? null
    const match = await db
      .collection("client_projects")
      .findOne({ ownerId: owner, name: sameName(project.name) }, { projection: { name: 1, promptInstructions: 1, folderId: 1 } })
    const prompts = await db.collection("created_prompts").countDocuments({ projectId: id })
    changes.push({
      project: { id, name: project.name, instructions: project.instructions ?? "", folderId: project.folderId ?? null, ownerId: owner },
      matchedClientProject: match ? { id: String(match._id), name: match.name } : null,
      prompts,
    })
    const where = match ? `-> client project "${match.name}" (${String(match._id)})` : "-> no project (its folder is kept)"
    console.log(`  "${project.name}": ${prompts} prompt${prompts === 1 ? "" : "s"} ${where}`)
  }

  if (isDryRun) {
    console.log("\nDry run: nothing was written.")
    return
  }

  mkdirSync(BACKUPS, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backup = join(BACKUPS, `prompt-projects-${stamp}.json`)
  writeFileSync(backup, JSON.stringify({ takenAt: new Date().toISOString(), documents: old, changes }, null, 2), "utf8")
  console.log(`\nBacked up to ${backup}`)

  for (const change of changes) {
    const { project, matchedClientProject } = change
    if (matchedClientProject) {
      const target = await db.collection("client_projects").findOne({ _id: new mongoose.Types.ObjectId(matchedClientProject.id) })
      const set = {}
      // The client project keeps whatever it already has; the old instructions only fill a gap
      if (project.instructions && !(target?.promptInstructions ?? "")) set.promptInstructions = project.instructions
      if (project.folderId && !(target?.folderId ?? null)) set.folderId = project.folderId
      if (Object.keys(set).length > 0) {
        await db.collection("client_projects").updateOne({ _id: new mongoose.Types.ObjectId(matchedClientProject.id) }, { $set: set })
      }
      const { modifiedCount } = await db
        .collection("created_prompts")
        .updateMany({ projectId: project.id }, { $set: { projectId: matchedClientProject.id } })
      console.log(`  "${project.name}": ${modifiedCount} prompt${modifiedCount === 1 ? "" : "s"} repointed`)
    } else {
      const { modifiedCount } = await db.collection("created_prompts").updateMany({ projectId: project.id }, { $set: { projectId: null } })
      console.log(`  "${project.name}": ${modifiedCount} prompt${modifiedCount === 1 ? "" : "s"} freed`)
    }
  }

  const { deletedCount } = await db.collection("prompt_projects").deleteMany({ _id: { $in: old.map((row) => row._id) } })
  console.log(`\nDeleted ${deletedCount} document${deletedCount === 1 ? "" : "s"} from prompt_projects.`)

  // Any prompt still naming a project nothing can resolve: the collection is gone, so it reads as none
  const live = await db.collection("client_projects").find({}, { projection: { _id: 1 } }).toArray()
  const ids = new Set(live.map((row) => String(row._id)))
  const dangling = await db.collection("created_prompts").find({ projectId: { $ne: null } }, { projection: { projectId: 1 } }).toArray()
  const lost = dangling.filter((row) => !ids.has(String(row.projectId))).map((row) => row._id)
  if (lost.length > 0) {
    await db.collection("created_prompts").updateMany({ _id: { $in: lost } }, { $set: { projectId: null } })
    console.log(`Freed ${lost.length} prompt${lost.length === 1 ? "" : "s"} whose project no longer exists.`)
  }
}

async function down(db) {
  const file = chosenFile
    ? join(root, chosenFile)
    : (() => {
        const names = readdirSync(BACKUPS).filter((name) => name.startsWith("prompt-projects-")).sort()
        if (names.length === 0) throw new Error("No prompt-projects backup in backups/ to restore from.")
        return join(BACKUPS, names[names.length - 1])
      })()
  const saved = JSON.parse(readFileSync(file, "utf8"))
  console.log(`Restoring ${saved.documents.length} document${saved.documents.length === 1 ? "" : "s"} from ${file}`)
  if (isDryRun) {
    console.log("Dry run: nothing was written.")
    return
  }
  const documents = saved.documents.map((row) => ({
    ...row,
    _id: new mongoose.Types.ObjectId(row._id.$oid ?? row._id),
    createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
  }))
  let restored = 0
  for (const document of documents) {
    const { upsertedCount, modifiedCount } = await db
      .collection("prompt_projects")
      .updateOne({ _id: document._id }, { $set: document }, { upsert: true })
    restored += upsertedCount + modifiedCount
  }
  console.log(`Restored ${restored}. The prompts are not repointed: see "changes" in the backup for what up did.`)
}

const uri = databaseUri()
await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 })
const db = mongoose.connection.db
console.log(`Database: ${db.databaseName}\n`)
try {
  if (direction === "up") await up(db)
  else await down(db)
} finally {
  await mongoose.disconnect()
}
