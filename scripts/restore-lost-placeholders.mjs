// Puts back the {{placeholders}} an edit dropped from a stored prompt. A placeholder is where a tool puts
// live data, and for some it is what turns a feature on: Comment Writer only researches the web for a
// tune whose prompt places {{research_context}}, and only looks up your experience for one that places
// {{user_experience}}. An end-to-end test of every prompt (27 Oct 2026) found two edited tunes that had
// lost theirs, so Latest Trends no longer researched and Based on My Past Experience no longer read your
// experience. The rule is src/lib/promptPlaceholders.ts (the admin editor uses it too): each lost one goes
// back with its own line and label from the original, above the HUMAN STYLE block, and the wording an
// admin wrote is kept.
//
//   node scripts/restore-lost-placeholders.mjs --dry-run   says what it would put back
//   node scripts/restore-lost-placeholders.mjs             puts them back
//   node scripts/restore-lost-placeholders.mjs --down      restores the text each prompt had before
//
// The text each prompt had is kept in prompt_revisions and in backups/ (git-ignored) before it is changed.

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { MongoClient } from "mongodb"

const require = createRequire(import.meta.url)
const createJiti = require("jiti")
const jiti = createJiti(import.meta.url, { alias: { "@": path.resolve("src") }, interopDefault: true })
const { lostPlaceholders, withPlaceholdersBack } = jiti(path.resolve("src/lib/promptPlaceholders.ts"))
const BACKUP_PREFIX = "lost-placeholders-"

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
  const db = client.db()
  const prompts = db.collection("prompts")

  if (down) {
    const files = existsSync("backups") ? readdirSync("backups").filter((name) => name.startsWith(BACKUP_PREFIX) && !name.endsWith(".restored.json")).sort() : []
    if (files.length === 0) fail(`No backups/${BACKUP_PREFIX}*.json to restore from.`)
    const file = `backups/${files.at(-1)}`
    for (const { key, content } of JSON.parse(readFileSync(file, "utf8")).prompts) {
      if (!dryRun) await prompts.updateOne({ key }, { $set: { content, updatedAt: new Date() } })
      console.log(`${dryRun ? "would restore" : "✓ restored"} ${key}`)
    }
    if (!dryRun) renameSync(file, file.replace(/\.json$/, ".restored.json"))
  } else {
    const changed = []
    for (const doc of await prompts.find({}).toArray()) {
      const lost = lostPlaceholders(doc.content, doc.defaultContent)
      if (lost.length === 0) continue
      changed.push({ doc, lost, content: withPlaceholdersBack(doc.content, doc.defaultContent) })
    }
    if (changed.length === 0) console.log("No stored prompt has lost a placeholder.")
    if (!dryRun && changed.length > 0) {
      mkdirSync("backups", { recursive: true })
      const takenAt = new Date().toISOString()
      writeFileSync(`backups/${BACKUP_PREFIX}${takenAt.replace(/[:.]/g, "-")}.json`, JSON.stringify({ takenAt, prompts: changed.map(({ doc }) => ({ key: doc.key, content: doc.content })) }, null, 2))
    }
    for (const { doc, lost, content } of changed) {
      if (!dryRun) {
        await db.collection("prompt_revisions").insertOne({ promptKey: doc.key, content: doc.content, createdAt: new Date(), updatedAt: new Date() })
        await prompts.updateOne({ key: doc.key }, { $set: { content, updatedAt: new Date() } })
      }
      console.log(`${dryRun ? "would put back" : "✓ put back"} ${lost.map((name) => `{{${name}}}`).join(", ")} in ${doc.key}`)
    }
  }
} finally {
  await client.close()
}
