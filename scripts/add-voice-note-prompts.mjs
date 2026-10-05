// Adds the Voice Note prompts, one per outreach module (src/constants/outreachTunes.ts VOICE_TUNE):
//   first-message-voice-note   a script to record and send as a LinkedIn voice note
//   inmail-voice-note          the same script, plus the subject the InMail carrying it needs
// Both place {{sender_profile}}, so the app gives them the whole of Global AI Prompts (About Me plus
// Rafay Profile Info) and every fact about the sender comes from there rather than from the prompt.
//
//   node scripts/add-voice-note-prompts.mjs                  adds them (a prompt already there is left alone)
//   node scripts/add-voice-note-prompts.mjs --down           removes them again
//   node scripts/add-voice-note-prompts.mjs --down --force   removes them even after someone edited them
//
// Up only ever inserts, so running it twice changes nothing. Down deletes only these two keys, and
// refuses a prompt whose text was edited in the app unless --force is given.

import { existsSync, readFileSync } from "node:fs"
import { MongoClient } from "mongodb"

const HUMAN_STYLE = `HUMAN STYLE (STRICT, NEVER BREAK THIS)
- Never use these symbols in the text you write: — (em dash), – (en dash), : (colon) or ; (semicolon). End the sentence and start a new one instead. Only a link or a time like 10:30 may contain a colon.
- Never use AI-sounding words such as seamless, seamlessly, robust, leverage, utilize, delve, elevate, unlock, empower, streamline, game-changer, cutting-edge, revolutionize, synergy, realm, tapestry, ecosystem, transformative or fast-paced. Use plain everyday words instead.
- Write like a real person talking. Simple words, short sentences, no corporate buzzwords.
- These rules override every example, template or structure above that shows one of these symbols or words.`

// The whole of the voice note brief, shared by both modules. Only the output differs.
const script = (intro, output) => `${intro}

The goal is NOT a sales pitch. The goal is that the person feels I actually looked at their profile, understood what they do, found a genuine connection to my own work, and reached out because of that.

WHAT I MAY SAY ABOUT MYSELF:
Everything true about me is in my profile below. Take my positioning, my experience, my numbers and my projects from there and nowhere else. Never invent a number, a client, a project or a result. If my profile is empty, speak about what I could help with in general words and give no numbers.

My profile:
{{sender_profile}}

Their profile:
{{profile_data}}

READ THEIR PROFILE FIRST (silently):
- Their first name, their role and how senior they are (founder, CEO, CTO, product, developer, agency owner).
- What they actually do, beyond their job title. What they are building, what the company does, who it is for.
- The strongest signal on the profile: a product they launched, something they are building, an AI or SaaS effort, scaling, hiring, a notable project, a problem they keep talking about.
- The one real connection between that and my own experience in my profile.
Take the single strongest connection. Never force one. If nothing is strong, take the closest honest one and keep it light.

THE SCRIPT:
1. A natural greeting with their first name. "Hi {{first_name}}, sorry for the voice note" is fine when it sounds natural.
2. One specific observation from their profile, in my own words. Not "I was impressed by your profile", not "I noticed you work in technology". Something only someone who read it could say.
3. Why that is close to the work I do, from my profile.
4. One or two proof points from my profile, the ones that fit this person. Never a list of everything I have done.
5. A soft line on how I could contribute. Never tell them what they need, what is wrong with their product, or that they clearly need a developer.
6. The main ask: a quick video showing how I could help with their specific product or problem.
7. The second ask, lighter: a quick 10 to 15 minute call this week or next, if that is easier.

HOW THEY DIFFER:
- Founder or CEO: product execution, taking the technical side off their hands, idea to production.
- CTO or technical lead: working with their team, full stack and AI execution, owning a piece of the work.
- Product lead: turning product ideas into working software, MVPs, AI features, speed.
- Agency owner: development support, working as their developer or alongside their team.
- They already have a live product: improvements, new features, AI added to what exists.

LENGTH, THIS IS THE HARD RULE:
- At most 120 words. Aim for 95 to 110.
- It must be sayable in under 50 seconds.
- Short sentences. Spoken English, not written English. Easy to read aloud in one take.

NEVER:
- Never start with "I hope you are doing well", "My name is", "I am reaching out because" or "I wanted to introduce myself".
- Never say I am looking for work, I need a project, or that I am an expert.
- Never mention five profile details to prove I did research. One strong one is better.
- Never invent anything about them: no funding, users, revenue, goals, problems or plans the profile does not state.
- Never use their full name, and never repeat their name through the script.
- Never say "I can send you my portfolio", and never push for a time ("book a call now", "are you free tomorrow").

TONE: confident, calm, friendly, direct, curious, low pressure. Never desperate, never over-excited, never formal.

${output}

${HUMAN_STYLE}`

const PROMPTS = [
  {
    key: "first-message-voice-note",
    tool: "first-message",
    content: script(
      "You are writing a LinkedIn voice note script for me to record and send to the person in the profile below. Write the words I will say out loud, nothing else.",
      `OUTPUT:
Write ONLY the words to say, as one short spoken paragraph. No heading, no stage directions, no word count, no notes, no quotation marks around it.`
    ),
  },
  {
    key: "inmail-voice-note",
    tool: "inmail-message",
    content: script(
      "You are writing a LinkedIn InMail that carries a voice note: a subject line for the InMail, and the script I will record and say out loud. Write both.",
      `OUTPUT:
- Subject: 3 to 6 words, under 40 characters, sentence case, no full stop at the end. Name one concrete thing from their profile, the same thing the script builds on. Never "Quick question", never "Voice note", never clickbait.
- Message: ONLY the words to say in the recording, as one short spoken paragraph. No heading, no stage directions, no word count and no notes.`
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
