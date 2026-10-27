// Deletes stored prompts that no code reads, so Administration → Global AI Prompts offers nothing an
// admin could edit to no effect. The end-to-end prompt test (27 Oct 2026) found one:
// `prompt-creator-transcription`, read by no code since Prompt Creator's speech moved to the shared
// transcription; the owner asked for it to go.
//
//   node scripts/delete-unused-prompts.mjs --dry-run   says what it would delete
//   node scripts/delete-unused-prompts.mjs             deletes it (the document is kept in backups/ first)
//   node scripts/delete-unused-prompts.mjs --down      puts it back from the newest backup
//
// Before deleting a key, check nothing in src/ names it (`grep -rn "<key>" src`).

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs"
import { MongoClient } from "mongodb"

const UNUSED = ["prompt-creator-transcription"]
const BACKUP_PREFIX = "unused-prompts-"

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

const dryRun = process.argv.includes("--dry-run")
const down = process.argv.includes("--down")
const client = new MongoClient(mongoUri())
try {
  await client.connect()
  const prompts = client.db().collection("prompts")
  if (down) {
    const files = existsSync("backups") ? readdirSync("backups").filter((name) => name.startsWith(BACKUP_PREFIX) && !name.endsWith(".restored.json")).sort() : []
    if (files.length === 0) fail(`No backups/${BACKUP_PREFIX}*.json to restore from.`)
    const file = `backups/${files.at(-1)}`
    for (const doc of JSON.parse(readFileSync(file, "utf8")).prompts) {
      const restored = { ...doc, createdAt: new Date(doc.createdAt), updatedAt: new Date(doc.updatedAt) }
      delete restored._id
      if (!dryRun) await prompts.replaceOne({ key: doc.key }, restored, { upsert: true })
      console.log(`${dryRun ? "would restore" : "✓ restored"} ${doc.key}`)
    }
    if (!dryRun) renameSync(file, file.replace(/\.json$/, ".restored.json"))
  } else {
    const found = await prompts.find({ key: { $in: UNUSED } }).toArray()
    if (found.length === 0) console.log("Nothing to delete: none of them is stored.")
    if (!dryRun && found.length > 0) {
      mkdirSync("backups", { recursive: true })
      const takenAt = new Date().toISOString()
      writeFileSync(`backups/${BACKUP_PREFIX}${takenAt.replace(/[:.]/g, "-")}.json`, JSON.stringify({ takenAt, prompts: found }, null, 2))
      await prompts.deleteMany({ key: { $in: found.map((doc) => doc.key) } })
    }
    for (const doc of found) console.log(`${dryRun ? "would delete" : "✓ deleted"} ${doc.key}`)
  }
} finally {
  await client.close()
}
