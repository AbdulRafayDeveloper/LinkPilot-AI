// Moves three things out of Administration → Global AI Prompts → Global & shared, at the owner's request:
//
//   1. Profile Info (the `global-rafay-profile` prompt, one copy for every account) becomes each person's
//      own, kept on their account (`users.profileInfo`, services/profileInfo.ts). Its text is copied to
//      the account named by --email (whose profile it is), and the shared prompt is deleted.
//   2. `lead-signals-system` becomes one copy per tool that shows lead signals:
//      `follow-up-lead-signals-system` (Follow-Up Message) and `conversation-reply-lead-signals-system`
//      (Conversation Reply), and the `lead-signals.*` sections of `shared-instructions` move into
//      `follow-up-instructions` and `conversation-reply-instructions`.
//   3. `post-image-extraction` becomes one copy per tool that reads a screenshot:
//      `comment-writer-post-image-extraction` (Comment Writer) and
//      `post-comment-reply-post-image-extraction` (Post Comment Replies), and the `screenshot.*` sections
//      move into `comment-writer-instructions` and `post-comment-reply-instructions`.
//
// Every copy starts from what is stored now, an admin's edits included, so nothing anyone wrote is lost.
//
// **Two steps, because the code that reads the old prompts is live until the new code is deployed:**
//
//   node scripts/move-shared-prompts-to-tools.mjs --email rafay@linkpilot.ai --dry-run   says what it would add
//   node scripts/move-shared-prompts-to-tools.mjs --email rafay@linkpilot.ai             adds (BEFORE the deploy)
//   node scripts/move-shared-prompts-to-tools.mjs --finish [--dry-run]                   removes the old shared
//                                                                                        copies (AFTER the deploy)
//   node scripts/move-shared-prompts-to-tools.mjs --down                                 puts everything back
//
// The first step only adds (the account's Profile Info, the four new prompts, the sections in each tool's
// instructions prompt), so the code running now keeps working. --finish deletes `global-rafay-profile`,
// `lead-signals-system` and `post-image-extraction` and takes the moved sections out of
// `shared-instructions`; until then the old copies sit unused and the admin page still lists them.
// Every document is written to backups/ (git-ignored) before it is touched, and --down restores the
// newest backup, so the steps are a round trip. The first step refuses to run twice and refuses an
// account that already has Profile Info of its own.

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs"
import { MongoClient } from "mongodb"

const PROFILE_KEY = "global-rafay-profile"
const SHARED_BOOK = "shared-instructions"
// Each shared prompt, the copies it becomes, and the sections that go with them
const SPLITS = [
  {
    from: "lead-signals-system",
    to: [
      { key: "follow-up-lead-signals-system", tool: "follow-up-message", book: "follow-up-instructions" },
      { key: "conversation-reply-lead-signals-system", tool: "conversation-reply", book: "conversation-reply-instructions" },
    ],
    sections: "lead-signals.",
  },
  {
    from: "post-image-extraction",
    to: [
      { key: "comment-writer-post-image-extraction", tool: "comment-writer", book: "comment-writer-instructions" },
      {
        key: "post-comment-reply-post-image-extraction",
        tool: "post-comment-replies",
        book: "post-comment-reply-instructions",
        // The copy for the reply tool says what it is for
        reword: ["for a comment-writing tool", "for a tool that writes replies to the comments under the post"],
      },
    ],
    sections: "screenshot.",
  },
]
const BACKUP_PREFIX = "shared-prompts-moved-"

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

// A prompt's sections, each with its heading, in order (the reader is src/services/promptBook.ts)
function splitSections(text) {
  const parts = text.replace(/\r\n/g, "\n").split(/^(?=##[ \t]+[\w.-]+[ \t]*$)/m)
  return parts.map((part) => ({ id: part.match(/^##[ \t]+([\w.-]+)/)?.[1] ?? null, text: part.trim() })).filter((part) => part.text)
}
const joinSections = (parts) => parts.map((part) => part.text).join("\n\n")
const takeSections = (text, prefix) => splitSections(text).filter((part) => part.id?.startsWith(prefix))
const withoutSections = (text, prefix) => joinSections(splitSections(text).filter((part) => !part.id?.startsWith(prefix)))
function withSections(text, added) {
  const have = new Set(splitSections(text).map((part) => part.id))
  const missing = added.filter((part) => !have.has(part.id))
  return missing.length === 0 ? text : `${text.trim()}\n\n${joinSections(missing)}`
}

const args = process.argv.slice(2)
const down = args.includes("--down")
const finish = args.includes("--finish")
const dryRun = args.includes("--dry-run")
const emailIndex = args.indexOf("--email")
const email = emailIndex >= 0 ? args[emailIndex + 1]?.toLowerCase() : null

const client = new MongoClient(mongoUri())
try {
  await client.connect()
  const db = client.db()
  const prompts = db.collection("prompts")
  const users = db.collection("users")

  if (down) {
    const files = existsSync("backups") ? readdirSync("backups").filter((name) => name.startsWith(BACKUP_PREFIX) && !name.endsWith(".restored.json")).sort() : []
    if (files.length === 0) fail(`No backups/${BACKUP_PREFIX}*.json to restore from.`)
    // Newest first, so --finish is undone before the first step, which ends with everything as it was
    for (const name of [...files].reverse()) {
      const file = `backups/${name}`
      const backup = JSON.parse(readFileSync(file, "utf8"))
      console.log(`Restoring from ${file}`)
      for (const doc of backup.prompts) {
        const restored = { ...doc, createdAt: new Date(doc.createdAt), updatedAt: new Date(doc.updatedAt) }
        delete restored._id
        if (!dryRun) await prompts.replaceOne({ key: doc.key }, restored, { upsert: true })
        console.log(`${dryRun ? "would restore" : "✓ restored"} ${doc.key}`)
      }
      for (const key of backup.created) {
        if (!dryRun) await prompts.deleteOne({ key })
        console.log(`${dryRun ? "would remove" : "✓ removed"} ${key}`)
      }
      if (backup.account) {
        const { id, profileInfo, profileInfoUpdatedAt } = backup.account
        if (!dryRun) {
          await users.updateOne({ email: backup.account.email }, { $set: { profileInfo, profileInfoUpdatedAt: profileInfoUpdatedAt ? new Date(profileInfoUpdatedAt) : null } })
        }
        console.log(`${dryRun ? "would put back" : "✓ put back"} the Profile Info of ${backup.account.email} (${id})`)
      }
      // A backup that has been restored is set aside, so a later run never replays it
      if (!dryRun) renameSync(file, file.replace(/\.json$/, ".restored.json"))
    }
  } else if (finish) {
    const keys = [PROFILE_KEY, SHARED_BOOK, ...SPLITS.map((split) => split.from)]
    const stored = new Map((await prompts.find({ key: { $in: keys } }).toArray()).map((doc) => [doc.key, doc]))
    for (const split of SPLITS) {
      for (const copy of split.to) if (!(await prompts.findOne({ key: copy.key }))) fail(`${copy.key} is missing: run the first step (with --email) before --finish.`)
    }
    if (!dryRun) {
      mkdirSync("backups", { recursive: true })
      const takenAt = new Date().toISOString()
      const file = `backups/${BACKUP_PREFIX}${takenAt.replace(/[:.]/g, "-")}.json`
      writeFileSync(file, JSON.stringify({ takenAt, step: "finish", prompts: [...stored.values()], created: [], account: null }, null, 2))
      console.log(`Backed up to ${file}`)
    }
    for (const key of [PROFILE_KEY, ...SPLITS.map((split) => split.from)]) {
      if (!stored.has(key)) {
        console.log(`- ${key}: already gone`)
        continue
      }
      if (!dryRun) await prompts.deleteOne({ key })
      console.log(`${dryRun ? "would remove" : "✓ removed"} ${key}`)
    }
    const shared = stored.get(SHARED_BOOK)
    if (shared) {
      const left = (text) => SPLITS.reduce((acc, split) => withoutSections(acc, split.sections), text)
      if (!dryRun) await prompts.updateOne({ key: SHARED_BOOK }, { $set: { content: left(shared.content), defaultContent: left(shared.defaultContent), updatedAt: new Date() } })
      console.log(`${dryRun ? "would take" : "✓ took"} the moved sections out of ${SHARED_BOOK}`)
    }
  } else {
    if (!email) fail("Name the account whose Profile Info the shared prompt is: --email <address>.")
    const account = await users.findOne({ email })
    if (!account) fail(`No account has the email ${email}.`)
    if (account.profileInfo?.trim()) fail(`${email} already has Profile Info of its own; nothing was changed.`)

    const keys = [PROFILE_KEY, SHARED_BOOK, ...SPLITS.flatMap((split) => [split.from, ...split.to.map((copy) => copy.book)])]
    const stored = new Map((await prompts.find({ key: { $in: keys } }).toArray()).map((doc) => [doc.key, doc]))
    for (const key of keys) if (!stored.has(key)) fail(`${key} is not in the prompts collection; has this already been run? (--down puts it back)`)
    for (const split of SPLITS) {
      for (const copy of split.to) if (await prompts.findOne({ key: copy.key })) fail(`${copy.key} already exists; has this already been run?`)
    }

    const backup = {
      takenAt: new Date().toISOString(),
      prompts: keys.map((key) => stored.get(key)),
      created: SPLITS.flatMap((split) => split.to.map((copy) => copy.key)),
      account: { id: String(account._id), email, profileInfo: account.profileInfo ?? "", profileInfoUpdatedAt: account.profileInfoUpdatedAt ?? null },
    }
    if (!dryRun) {
      mkdirSync("backups", { recursive: true })
      const file = `backups/${BACKUP_PREFIX}${backup.takenAt.replace(/[:.]/g, "-")}.json`
      writeFileSync(file, JSON.stringify(backup, null, 2))
      console.log(`Backed up to ${file}`)
    }
    const now = new Date()

    // 1. Profile Info becomes the account's own
    const profile = stored.get(PROFILE_KEY)
    if (!dryRun) await users.updateOne({ _id: account._id }, { $set: { profileInfo: profile.content, profileInfoUpdatedAt: now } })
    console.log(`${dryRun ? "would copy" : "✓ copied"} Profile Info (${profile.content.length} characters) to ${email}`)

    // 2 and 3. Each shared prompt becomes one copy per tool, and its sections go with it
    const shared = stored.get(SHARED_BOOK)
    for (const split of SPLITS) {
      const source = stored.get(split.from)
      const sections = takeSections(shared.content, split.sections)
      const defaultSections = takeSections(shared.defaultContent, split.sections)
      if (sections.length === 0) fail(`${SHARED_BOOK} has no ${split.sections}* sections.`)
      for (const copy of split.to) {
        const reword = (text) => (copy.reword ? text.split(copy.reword[0]).join(copy.reword[1]) : text)
        const book = stored.get(copy.book)
        if (!dryRun) {
          await prompts.insertOne({
            key: copy.key,
            tool: copy.tool,
            editable: false,
            content: reword(source.content),
            defaultContent: reword(source.defaultContent),
            description: "",
            createdAt: now,
            updatedAt: now,
          })
          await prompts.updateOne(
            { key: copy.book },
            { $set: { content: withSections(book.content, sections), defaultContent: withSections(book.defaultContent, defaultSections), updatedAt: now } }
          )
        }
        console.log(`${dryRun ? "would add" : "✓ added"} ${copy.key} (${copy.tool}) and ${sections.length} ${split.sections}* sections to ${copy.book}`)
      }
    }
    console.log("Deploy the new code, then run this again with --finish to remove the old shared copies.")
  }
} finally {
  await client.close()
}
