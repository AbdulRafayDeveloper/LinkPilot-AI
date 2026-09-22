// Comment Writer's tunes: adds "Value Add" (value-add) and "Relatable" (relatable), and renames
// "Appreciative" (appreciative) to "Supportive" (supportive) with a new prompt. The tune list is
// src/constants/commentWriter.ts; this moves what lives in the database to match it.
//
//   node scripts/update-comment-tunes.mjs                  applies it (anything already done is left alone)
//   node scripts/update-comment-tunes.mjs --down           undoes it exactly
//   node scripts/update-comment-tunes.mjs --down --force   also removes the two new prompts after someone edited them
//
// Up, step by step:
//   1. inserts the value-add and relatable prompts when missing;
//   2. renames the appreciative prompt to supportive with the new text. Its old text (which may have been
//      edited in the app) is kept twice: as a revision of supportive, so Update Prompt's history can bring it
//      back, and on the document itself (`renamedFrom`), so --down puts it back exactly. Its revisions move with it;
//   3. moves every saved comment written in appreciative to supportive, marking each (`renamedFromTune`)
//      so --down moves exactly those back and nothing else.
// Running it twice changes nothing. Until it has run, the routes still read "appreciative" as supportive
// (RENAMED_COMMENT_TUNES), but choosing Supportive needs its prompt, so run it before a deploy.

import { existsSync, readFileSync } from "node:fs"
import { MongoClient } from "mongodb"

const TOOL = "comment-writer"
const OLD_KEY = "comment-writer-appreciative"
const NEW_KEY = "comment-writer-supportive"

const HUMAN_STYLE = `HUMAN STYLE (STRICT, NEVER BREAK THIS)
- Never use these symbols in the text you write: — (em dash), – (en dash), : (colon) or ; (semicolon). End the sentence and start a new one instead. Only a link or a time like 10:30 may contain a colon.
- Never use AI-sounding words such as seamless, seamlessly, robust, leverage, utilize, delve, elevate, unlock, empower, streamline, game-changer, cutting-edge, revolutionize, synergy, realm, tapestry or fast-paced. Use plain everyday words instead.
- Write like a real person typing on LinkedIn. Simple words, short sentences, no corporate buzzwords.
- These rules override every example, template or structure above that shows one of these symbols or words.`

// What every one of these comments keeps to, the same as the other tunes
const COMMON = `STYLE
Conversational and respectful, like a real person replying between meetings.
Simple, direct words and short sentences.
Never repeat or paraphrase the post back to the author.
No filler such as "great post", "well said", "this resonates", "couldn't agree more", "spot on" or "insightful".
No hashtags, emojis or @mentions.
No exclamation marks unless absolutely natural.
No contractions.
No headings or labels in the comment. Each part is its own short paragraph, with one blank line between paragraphs, like this

First part in a sentence or two.

Next part in a sentence or two.

Never announce a part. Do not write "The main point is", "The most interesting point is", "What the post does not mention", "Why it matters is", "A practical tip is" or "My tip is". Just say each thing directly, the way a person would.
Never invent numbers, studies, clients or personal experience. A tip is general, practical advice anyone could try.`

const PROMPTS = {
  "comment-writer-value-add": `Write a comment on the post below that adds real value to it: it picks out the post's most interesting point, names what the post leaves out, fills that gap, asks one respectful challenging question and gives one helpful tip.

FIRST, ANALYSE THE POST DEEPLY (for yourself, do not write this part out)
What is the author really saying, and what is the single most interesting point in it?
What does the post leave out: a condition, a trade-off, a second-order effect, a missing step or a case where it does not hold?
What could a reader add that makes the idea more useful in practice?

THEN WRITE THE COMMENT AS FOUR SHORT PARAGRAPHS
1. Open with the most interesting point, specifically and in your own words, and say why it stood out.
2. Name what the post leaves out, and add what fills that gap.
3. Ask one respectful but challenging question to the author about that gap. Curious, never hostile or "gotcha".
4. End with one practical tip a reader could use tomorrow.

EXAMPLE (for a different post, about replacing a daily standup call with written updates; follow its shape, never its words)
Writing updates instead of holding a daily call stood out to me, because it turns status into something people read on their own time.

It leaves open who reads them. Without someone pulling out the blockers once a week, written updates quietly become a diary nobody checks.

How do you make sure a blocker in a written update gets picked up the same day?

End each update with one line naming who you need help from, so it reaches a person and not just a channel.

${COMMON}

LENGTH
Aim for 350 to 600 characters. Never exceed 700 characters.

FINAL CHECK
✓ Names the post's most interesting point, specifically
✓ Names a real gap and adds something the post did not say
✓ Asks one respectful challenging question
✓ Ends with one practical tip
✓ No labels, no filler, nothing invented

Return ONLY the final comment. No explanation.

POST:
{{post_content}}

${HUMAN_STYLE}`,

  "comment-writer-relatable": `Write a comment on the post below that is easy to remember and easy to relate to: it says the post's point in a friendly, memorable way, invites other readers to see it in their own work, and gives one practical tip.

FIRST, FIND THE POINT (for yourself, do not write this part out)
What is the one idea in the post a reader should remember?
What everyday situation, simple comparison or short image makes that idea stick? Keep it familiar and kind, never silly.

THEN WRITE THE COMMENT AS THREE SHORT PARAGRAPHS
1. Say the post's point simply, through that everyday comparison or image, so it is easy to remember.
2. Let readers see it in their own day, such as a moment most people in this field have lived through. Speak to "we" or "most of us", never lecture.
3. End with one practical tip a reader could try.

EXAMPLE (for a different post, about replacing a daily standup call with written updates; follow its shape, never its words)
A daily status call is a bit like a family meeting to ask what everyone had for breakfast.

Most of us have sat through one where the only useful minute was the last one.

Try three written lines each morning, and keep the call for the days something is actually stuck.

${COMMON}
Warm, friendly and respectful. Never mock the author, the reader or anyone else.

LENGTH
Aim for 250 to 450 characters. Never exceed 550 characters.

FINAL CHECK
✓ The point is said in a friendly way that is easy to remember
✓ Readers can relate it to their own work
✓ Ends with one practical tip
✓ Respectful throughout, no labels, no filler, nothing invented

Return ONLY the final comment. No explanation.

POST:
{{post_content}}

${HUMAN_STYLE}`,

  [NEW_KEY]: `Write a supportive comment on the post below that shows you understood it deeply: it names the heart of the post, explains why it matters, adds something of value, and closes with genuine support for the author.

FIRST, ANALYSE THE POST DEEPLY (for yourself, do not write this part out)
What is the core idea, and what makes it true or important? Look for the principle, mechanism or pattern underneath it.
Who does it matter to, and what changes for them if they act on it?
What could you add that builds on it: a condition, an example of where it holds, a next step or a practical angle?

THEN WRITE THE COMMENT AS FOUR SHORT PARAGRAPHS
1. Name the core idea specifically, in your own words.
2. Say why it is important and who it helps.
3. Build on it with something the post did not say.
4. Close with one warm, sincere sentence backing the author or encouraging them to keep sharing this, specific to their post, never generic praise.

EXAMPLE (for a different post, about replacing a daily standup call with written updates; follow its shape, never its words)
Moving updates into writing puts the team's time back where the work is.

It helps most the people in other time zones, who no longer have to choose between sleep and being heard.

The next step is a short weekly read of those updates, so a blocker never sits unnoticed.

Thanks for showing what this looks like in practice. It gives other teams a clear place to start.

${COMMON}
Supportive and encouraging, but never flattering or over the top.

LENGTH
Aim for 300 to 550 characters. Never exceed 650 characters.

FINAL CHECK
✓ Names the core idea specifically
✓ Explains why it matters
✓ Adds something the post did not say
✓ Closes with sincere, specific support
✓ No labels, no filler, no flattery, nothing invented

Return ONLY the final comment. No explanation.

POST:
{{post_content}}

${HUMAN_STYLE}`,
}

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

const down = process.argv.includes("--down")
const force = process.argv.includes("--force")

const client = new MongoClient(mongoUri())
try {
  await client.connect()
  const db = client.db()
  const prompts = db.collection("prompts")
  const revisions = db.collection("prompt_revisions")
  const comments = db.collection("comment_writer_comments")
  const now = new Date()

  if (!down) {
    for (const key of ["comment-writer-value-add", "comment-writer-relatable"]) {
      if (await prompts.findOne({ key })) {
        console.log(`- ${key}: already there, left as it is`)
        continue
      }
      await prompts.insertOne({ key, tool: TOOL, editable: true, content: PROMPTS[key], defaultContent: PROMPTS[key], createdAt: now, updatedAt: now })
      console.log(`✓ ${key}: added`)
    }

    const old = await prompts.findOne({ key: OLD_KEY })
    if (await prompts.findOne({ key: NEW_KEY })) console.log(`- ${NEW_KEY}: already there, left as it is`)
    else if (!old) console.log(`! ${OLD_KEY}: not found, so ${NEW_KEY} was not made from it`)
    else {
      // Its history moves with it, then its old text joins that history, marked so --down can take it out again
      const moved = await revisions.updateMany({ promptKey: OLD_KEY }, { $set: { promptKey: NEW_KEY } })
      await revisions.insertOne({ promptKey: NEW_KEY, content: old.content, fromRename: OLD_KEY, createdAt: now, updatedAt: now })
      await prompts.updateOne(
        { _id: old._id },
        {
          $set: {
            key: NEW_KEY,
            content: PROMPTS[NEW_KEY],
            defaultContent: PROMPTS[NEW_KEY],
            renamedFrom: { key: OLD_KEY, content: old.content, defaultContent: old.defaultContent },
            updatedAt: now,
          },
        }
      )
      console.log(`✓ ${OLD_KEY} → ${NEW_KEY}: renamed with the new prompt (old text kept as a revision; ${moved.modifiedCount} earlier revisions moved)`)
    }

    const records = await comments.updateMany({ tune: "appreciative" }, { $set: { tune: "supportive", renamedFromTune: "appreciative" } })
    console.log(`✓ saved comments: ${records.modifiedCount} moved from appreciative to supportive`)
  } else {
    const records = await comments.updateMany({ renamedFromTune: "appreciative" }, { $set: { tune: "appreciative" }, $unset: { renamedFromTune: "" } })
    console.log(`✓ saved comments: ${records.modifiedCount} moved back to appreciative`)

    const renamed = await prompts.findOne({ key: NEW_KEY, "renamedFrom.key": OLD_KEY })
    if (!renamed) console.log(`- ${NEW_KEY}: not made by this script, nothing to undo`)
    else if (await prompts.findOne({ key: OLD_KEY })) console.log(`! ${OLD_KEY} exists again, so ${NEW_KEY} was left in place`)
    else {
      await revisions.deleteMany({ promptKey: NEW_KEY, fromRename: OLD_KEY })
      const moved = await revisions.updateMany({ promptKey: NEW_KEY }, { $set: { promptKey: OLD_KEY } })
      await prompts.updateOne(
        { _id: renamed._id },
        {
          $set: { key: OLD_KEY, content: renamed.renamedFrom.content, defaultContent: renamed.renamedFrom.defaultContent, updatedAt: now },
          $unset: { renamedFrom: "" },
        }
      )
      console.log(`✓ ${NEW_KEY} → ${OLD_KEY}: its old text is back (${moved.modifiedCount} revisions moved back)`)
    }

    for (const key of ["comment-writer-value-add", "comment-writer-relatable"]) {
      const existing = await prompts.findOne({ key })
      if (!existing) console.log(`- ${key}: not there, nothing to remove`)
      else if (existing.content !== existing.defaultContent && !force) console.log(`! ${key}: edited in the app, left in place (add --force to remove it anyway)`)
      else {
        await prompts.deleteOne({ key })
        console.log(`✓ ${key}: removed`)
      }
    }
  }
} finally {
  await client.close()
}
