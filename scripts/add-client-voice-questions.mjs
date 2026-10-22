// Teaches Client Voices to write down what the client **asked**, beside what they asked for.
//
// A client's voice messages are half requests and half questions. The task list only ever carried
// the requests, so a question was either lost or turned into work nobody asked for. The module now
// answers two lists (src/services/clientVoices/tasks.ts), and this adds the rules for the second one
// to the fixed system prompt:
//
//   client-voice-tasks-system   fixed: the rules an edit in the app can never remove
//
// The **editable** prompt (client-voice-tasks) is deliberately left alone: it is the owner's own
// wording, and the rules belong in the fixed prompt. The questions field is also described in the
// schema the model is given, so the lists are written either way; this is what makes the second one
// as careful as the first.
//
//   node scripts/add-client-voice-questions.mjs --dry-run   says what it would change, writes nothing
//   node scripts/add-client-voice-questions.mjs             adds the block (running it twice changes nothing)
//   node scripts/add-client-voice-questions.mjs --down      takes the block off again
//
// The block is found by its own heading, so this only ever adds or removes that block and never
// touches a word of the rest of the prompt. The text the prompt had before is kept in
// `prompt_revisions` either way, so nothing is unrecoverable. Run it before a deploy.

import { existsSync, readFileSync } from "node:fs"
import { MongoClient } from "mongodb"

const KEY = "client-voice-tasks-system"

// The heading is the marker: it is what makes adding this twice impossible and removing it exact
const HEADING = "WHAT THE CLIENT ASKED (QUESTIONS)"

const BLOCK = `${HEADING}
Some of what a client says is not a request at all. It is a question they want answered.

- A question goes in the questions list, never in the tasks list, and never in both. "Can you change the logo colour" is a task. "Is the logo colour final" is a question.
- Write it as a clear question in English, in as few words as say it, keeping every name, number, date and condition they used.
- One entry per distinct question. The same question asked in three voices is one entry carrying all three voice numbers.
- Only what is really waiting for an answer from you. Something they wondered aloud and then answered themselves is not a question, and neither is a greeting, a thank you or thinking out loud.
- Invent nothing. If they asked nothing, the questions list is empty, which is ordinary.`

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

const withBlock = (text) => `${text.trimEnd()}\n\n${BLOCK}\n`

/** Takes the block off again, leaving the rest of the prompt exactly as it was. */
function withoutBlock(text) {
  const at = text.indexOf(HEADING)
  if (at < 0) return text
  return `${text.slice(0, at).trimEnd()}\n`
}

const isDryRun = process.argv.includes("--dry-run")
const down = process.argv.includes("--down")

const client = new MongoClient(mongoUri())
try {
  await client.connect()
  const prompts = client.db().collection("prompts")
  const revisions = client.db().collection("prompt_revisions")
  const existing = await prompts.findOne({ key: KEY })
  if (!existing) fail(`${KEY} is not in the database. Client Voices has never run here, so there is nothing to add to.`)

  const has = (existing.content ?? "").includes(HEADING)
  if (down ? !has : has) {
    console.log(`- ${KEY}: ${down ? "the questions block is not there" : "already asks for the questions"}. Nothing to do.`)
  } else {
    const change = down ? withoutBlock : withBlock
    const content = change(existing.content ?? "")
    const defaultContent = change(existing.defaultContent ?? existing.content ?? "")
    if (isDryRun) {
      console.log(`Dry run: would ${down ? "remove" : "add"} the questions block on ${KEY} (${content.length} characters after it). Nothing written.`)
    } else {
      const now = new Date()
      // The text it had before, kept so an overwritten prompt is never unrecoverable
      await revisions.insertOne({ promptKey: KEY, content: existing.content ?? "", createdAt: now, updatedAt: now })
      await prompts.updateOne({ key: KEY }, { $set: { content, defaultContent, updatedAt: now } })
      console.log(`✓ ${KEY}: questions block ${down ? "removed" : "added"}, and the text it had is kept as a revision.`)
    }
  }
} finally {
  await client.close()
}
