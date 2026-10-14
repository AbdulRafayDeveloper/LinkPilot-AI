#!/usr/bin/env node
/**
 * Adds the sample data Post Image Creator was missing.
 *
 * Dummy Data for Testing is read tool wise now, and that showed up the one LinkedIn tool with an
 * input and no sample data at all: Post Image Creator, which draws a picture from whatever the post
 * is about. Its kind is `post-images` (one `post` field, the tool's own `postContent`), and these
 * three posts are the three shapes it has to draw for: a launch, a lesson with a number in it, and
 * a short opinion with no product behind it.
 *
 *   node scripts/add-post-image-dummy-data.mjs [--dry-run]
 *   node scripts/add-post-image-dummy-data.mjs --down [--force]
 *
 * It only ever **inserts a missing item**, so running it twice changes nothing and an item edited
 * in the app is never overwritten. `--down` removes exactly the items it added, and refuses one
 * whose text has been changed since unless `--force` is given.
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import mongoose from "mongoose"

const dryRun = process.argv.includes("--dry-run")
const down = process.argv.includes("--down")
const force = process.argv.includes("--force")

function databaseUri() {
  for (const name of [".env.local", ".env"]) {
    const path = join(process.cwd(), name)
    if (!existsSync(path)) continue
    const line = readFileSync(path, "utf8")
      .split("\n")
      .find((row) => row.startsWith("MONGODB_URI="))
    if (line) return line.slice("MONGODB_URI=".length).trim().replace(/^"|"$/g, "")
  }
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI
  throw new Error("MONGODB_URI is not set: put it in .env.local or the environment.")
}

// The id the app gives an item, from its name (services/dummyData.ts)
const slugify = (name) =>
  name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 50)
    .replace(/^-+|-+$/g, "") || "item"

const ITEMS = [
  {
    kind: "post-images",
    name: "Launch post for an AI scheduling app (fictional)",
    fields: {
      post: `We just shipped Slotly.

Booking a meeting with a client used to take us four emails and a guess at their timezone. Now it takes one link.

What it does:
- reads your calendar and only ever offers time you actually have
- asks the client two questions before the call so you walk in prepared
- writes the follow up for you while the call is still fresh

It is live today for teams of two to twenty. If you book client calls for a living, I would like you to break it.`,
    },
  },
  {
    kind: "post-images",
    name: "Lesson post with one number in it (fictional)",
    fields: {
      post: `We cut our onboarding from eleven screens to three and signups went up 42%.

Nothing was wrong with the eleven screens. Each one asked something we genuinely wanted to know. The problem was that we asked all of it before the product had done anything for them.

So we moved eight of those questions to after the first win. Same questions, same answers, different moment.

If your form is long, the fix is usually not a shorter form. It is a later one.`,
    },
  },
  {
    kind: "post-images",
    name: "Short opinion post, nothing to sell (fictional)",
    fields: {
      post: `A website is not a brochure. It is the first conversation.

If it cannot answer what this is and who it is for in five seconds, nothing else on the page matters. Not the animation, not the testimonials, not the pricing table you spent a week on.

Three good sentences at the top beat a slider every single time.`,
    },
  },
]

const run = async () => {
  await mongoose.connect(databaseUri(), { dbName: "LinkPilot" })
  const items = mongoose.connection.db.collection("dummy_data")

  if (down) {
    let removed = 0
    for (const item of ITEMS) {
      const slug = slugify(item.name)
      const stored = await items.findOne({ kind: item.kind, slug })
      if (!stored) {
        console.log(`- ${item.kind}/${slug}: not there`)
        continue
      }
      const sameText = Object.entries(item.fields).every(([key, value]) => (stored.fields?.[key] ?? "") === value)
      if (!sameText && !force) {
        console.log(`! ${item.kind}/${slug}: changed in the app, left alone (use --force to remove it anyway)`)
        continue
      }
      if (!dryRun) await items.deleteOne({ _id: stored._id })
      removed += 1
      console.log(`${dryRun ? "would remove" : "removed"} ${item.kind}/${slug}`)
    }
    console.log(`\n${dryRun ? "Would remove" : "Removed"} ${removed} item(s).`)
    await mongoose.disconnect()
    return
  }

  let added = 0
  for (const item of ITEMS) {
    const slug = slugify(item.name)
    const stored = await items.findOne({ kind: item.kind, slug })
    if (stored) {
      console.log(`= ${item.kind}/${slug}: already there, left exactly as it is`)
      continue
    }
    if (!dryRun) {
      const now = new Date()
      await items.insertOne({ kind: item.kind, slug, name: item.name, fields: item.fields, createdAt: now, updatedAt: now })
    }
    added += 1
    console.log(`${dryRun ? "would add" : "added"} ${item.kind}/${slug} — ${item.name}`)
  }
  console.log(`\n${dryRun ? "Would add" : "Added"} ${added} item(s) of ${ITEMS.length}.`)
  await mongoose.disconnect()
}

run().catch(async (error) => {
  console.error("Failed:", error instanceof Error ? error.message : error)
  try {
    await mongoose.disconnect()
  } catch {}
  process.exit(1)
})
