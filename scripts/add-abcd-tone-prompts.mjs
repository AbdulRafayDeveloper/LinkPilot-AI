// Adds the ABCD Method prompts, one per outreach module (src/constants/outreachTunes.ts ABCD_TUNE):
//   first-message-abcd-method   a short personal DM that ends on the four replies
//   inmail-abcd-method          the same, plus the subject the InMail needs
// The four replies themselves are fixed in code (src/lib/abcdMethod.ts) and put on the message there,
// so they are always the owner's own wording and never the crude version of D this method is known for.
// Both prompts place {{sender_profile}}, so every fact about the sender comes from Global AI Prompts.
//
//   node scripts/add-abcd-tone-prompts.mjs                  adds them (a prompt already there is left alone)
//   node scripts/add-abcd-tone-prompts.mjs --down           removes them again
//   node scripts/add-abcd-tone-prompts.mjs --down --force   removes them even after someone edited them

import { existsSync, readFileSync } from "node:fs"
import { MongoClient } from "mongodb"

const HUMAN_STYLE = `HUMAN STYLE (STRICT, NEVER BREAK THIS)
- Never use these symbols in the text you write: — (em dash), – (en dash), : (colon) or ; (semicolon). End the sentence and start a new one instead. Only a link, a time like 10:30, or the line that introduces the four replies may contain a colon.
- Never use AI-sounding words such as seamless, seamlessly, robust, leverage, utilize, delve, elevate, unlock, empower, streamline, game-changer, cutting-edge, revolutionize, synergy, realm, tapestry, ecosystem or fast-paced. Use plain everyday words instead.
- Write like a real person typing on LinkedIn. Simple words, short sentences, no corporate buzzwords.
- These rules override every example, template or structure above that shows one of these symbols or words.`

const OPTIONS = `Just reply with a letter:
A - Yes, I'm interested, let's move forward
B - I'm interested, but not right now
C - I'm not really interested at all
D - Leave me alone`

const brief = (what, output) => `You are writing ${what} to the person in the profile below, using the A, B, C, D method: a short personal message that ends by offering four replies, so answering costs them one letter.

WHAT I MAY SAY ABOUT MYSELF:
Everything true about me is in my profile below. Take my work, my experience and my numbers from there and nowhere else. Never invent a number, a client, a project or a result. If my profile is empty, say what I could help with in general words and give no numbers.

My profile:
{{sender_profile}}

Their profile:
{{profile_data}}

THE MESSAGE, IN THIS ORDER:
1. "Hi {{first_name}}," and then one sentence naming one specific thing from their profile: what they are building, a product, a project or the stage they are at. Something only someone who read the profile could write. Never "I was impressed by your profile" and never "I noticed you work in technology".
2. One sentence tying that to what I do, from my profile, and at most one proof point that fits this person. Never a list of everything I have done.
3. One short sentence on how I could help with that specific thing, offered lightly. Never tell them what they need or what is wrong with their product.
4. The four replies, exactly as written below, on their own lines at the end.

THE FOUR REPLIES, WORD FOR WORD, ALWAYS ALL FOUR, ALWAYS LAST:
${OPTIONS}

RULES:
- Never change, reorder, reword or drop any of the four lines, and never add a fifth. Keep D exactly as it is written above and never make it rude.
- Nothing after the four lines. No sign-off, no name, no postscript.
- Before the four lines, 35 to 60 words. Short sentences, the way a person types.
- One question at most before the four lines, and it is fine to have none, because the four replies are the ask.
- Use their first name once, at the start. Never their full name.
- Never invent anything about them: no funding, users, revenue, goals, problems or plans the profile does not state.
- Never say I am looking for work, that I need a project or that I am an expert.
- Never ask for a call, a meeting or a time. The letters are the only ask.

TONE: calm, direct, friendly, low pressure, one professional to another.

${output}

${HUMAN_STYLE}`

const PROMPTS = [
  {
    key: "first-message-abcd-method",
    tool: "first-message",
    content: brief(
      "a first LinkedIn message (a DM)",
      `OUTPUT:
Write ONLY the message, with the four replies on their own lines at the end. No heading and no notes.`
    ),
  },
  {
    key: "inmail-abcd-method",
    tool: "inmail-message",
    content: brief(
      "a LinkedIn InMail (a subject line and a message)",
      `OUTPUT:
- Subject: 3 to 6 words, under 40 characters, sentence case, no full stop at the end. Name one concrete thing from their profile, the same thing the message opens on. Never "Quick question" and never clickbait.
- Message: the message itself, with the four replies on their own lines at the end. No heading and no notes.`
    ),
  },
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

const down = process.argv.includes("--down")
const force = process.argv.includes("--force")

const client = new MongoClient(mongoUri())
try {
  await client.connect()
  const prompts = client.db().collection("prompts")
  for (const { key, tool, content } of PROMPTS) {
    const existing = await prompts.findOne({ key })
    if (down) {
      if (!existing) {
        console.log(`- ${key}: not there, nothing to remove`)
        continue
      }
      if (existing.content !== existing.defaultContent && !force) {
        console.log(`! ${key}: edited in the app, left in place (add --force to remove it anyway)`)
        continue
      }
      await prompts.deleteOne({ key })
      console.log(`✓ ${key}: removed`)
      continue
    }
    if (existing) {
      console.log(`- ${key}: already there, left as it is`)
      continue
    }
    const now = new Date()
    await prompts.insertOne({ key, tool, editable: true, content, defaultContent: content, createdAt: now, updatedAt: now })
    console.log(`✓ ${key}: added`)
  }
} finally {
  await client.close()
}
