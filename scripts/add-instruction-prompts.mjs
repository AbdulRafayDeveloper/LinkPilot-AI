// Adds each module's instructions prompt, and the one every tool shares, to the prompts
// collection (src/services/promptBook.ts). The LinkedIn tools and the shared one first:
//   connection-note-instructions, comment-writer-instructions, post-comment-reply-instructions,
//   follow-up-instructions, first-message-instructions, inmail-instructions,
//   conversation-reply-instructions, trending-instructions, post-image-instructions, shared-instructions
// then Workspace: prompt-creator-instructions, message-rewriter-instructions, quick-notes-instructions,
//   task-details-instructions (Daily Tasks and an employee's plan)
// then Client Work: client-message-instructions, client-voices-instructions, meetings-instructions,
//   meeting-planner-instructions
//
// Everything a tool sends a model besides the prompts its users choose (the rewrite requests, each
// problem its checks find, block labels, empty texts, what each field of an answer means) used to be
// written in the code. It is read from these prompts now, so an admin can change any of it under
// Administration → Global AI Prompts → System, and the next result anyone writes uses it. The text of
// each one is the matching file in scripts/instruction-prompts/, word for word what the code said.
//
//   node scripts/add-instruction-prompts.mjs                  adds the prompts (one already there is left alone)
//   node scripts/add-instruction-prompts.mjs --dry-run        says what it would add, and changes nothing
//   node scripts/add-instruction-prompts.mjs --down           removes them again
//   node scripts/add-instruction-prompts.mjs --down --force   removes them even after an admin edited one
//
// Up only ever inserts, so running it twice changes nothing and never overwrites an admin's edit.
// Down deletes only these keys, and refuses one an admin has changed unless --force is given. Run it
// wherever the database lacks them BEFORE a deploy: the tools read these prompts on every request,
// and a missing one stops the tool with an error naming it rather than falling back to text in code.

import { existsSync, readFileSync } from "node:fs"
import { MongoClient } from "mongodb"

// Each instructions prompt and the module it belongs to (the `tool` it is stored and edited under)
const PROMPTS = [
  { key: "connection-note-instructions", tool: "connection-note" },
  { key: "comment-writer-instructions", tool: "comment-writer" },
  { key: "post-comment-reply-instructions", tool: "post-comment-replies" },
  { key: "follow-up-instructions", tool: "follow-up-message" },
  { key: "first-message-instructions", tool: "first-message" },
  { key: "inmail-instructions", tool: "inmail-message" },
  { key: "conversation-reply-instructions", tool: "conversation-reply" },
  { key: "trending-instructions", tool: "trending-topics" },
  { key: "post-image-instructions", tool: "post-image-creator" },
  { key: "shared-instructions", tool: "shared" },
  // Workspace
  { key: "prompt-creator-instructions", tool: "prompt-creator" },
  { key: "message-rewriter-instructions", tool: "message-rewriter" },
  { key: "quick-notes-instructions", tool: "quick-notes" },
  { key: "task-details-instructions", tool: "daily-tasks" },
  // Client Work
  { key: "client-message-instructions", tool: "client-messaging" },
  { key: "client-voices-instructions", tool: "client-voices" },
  { key: "meetings-instructions", tool: "meetings" },
  { key: "meeting-planner-instructions", tool: "meeting-planner" },
]

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
  const uri = line?.slice("MONGODB_URI=".length).trim().replace(/^["']|["']$/g, "")
  if (!uri) fail("MONGODB_URI is missing from .env.local.")
  return uri
}

// The text as the file has it, line endings made plain, so a checkout on Windows stores the same prompt
function contentOf(key) {
  const path = new URL(`./instruction-prompts/${key}.md`, import.meta.url)
  if (!existsSync(path)) fail(`scripts/instruction-prompts/${key}.md is missing.`)
  const content = readFileSync(path, "utf8").replace(/\r\n/g, "\n").trim()
  if (!/^##[ \t]+[\w.-]+[ \t]*$/m.test(content)) fail(`${key}.md has no "## <section>" headings.`)
  return content
}

const down = process.argv.includes("--down")
const force = process.argv.includes("--force")
const dryRun = process.argv.includes("--dry-run")

const client = new MongoClient(mongoUri())
try {
  await client.connect()
  const prompts = client.db().collection("prompts")
  for (const { key, tool } of PROMPTS) {
    const content = contentOf(key)
    const existing = await prompts.findOne({ key })
    if (down) {
      if (!existing) {
        console.log(`- ${key}: not there, nothing to remove`)
        continue
      }
      if (existing.content !== existing.defaultContent && !force) {
        console.log(`! ${key}: edited by an admin, left in place (add --force to remove it anyway)`)
        continue
      }
      if (!dryRun) await prompts.deleteOne({ key })
      console.log(`${dryRun ? "would remove" : "✓ removed"} ${key}`)
      continue
    }
    if (existing) {
      console.log(`- ${key}: already there, left as it is`)
      continue
    }
    const sections = content.match(/^##[ \t]+[\w.-]+/gm).length
    if (!dryRun) {
      const now = new Date()
      await prompts.insertOne({ key, tool, editable: false, content, defaultContent: content, createdAt: now, updatedAt: now })
    }
    console.log(`${dryRun ? "would add" : "✓ added"} ${key} (${tool}, ${sections} sections)`)
  }
} finally {
  await client.close()
}
