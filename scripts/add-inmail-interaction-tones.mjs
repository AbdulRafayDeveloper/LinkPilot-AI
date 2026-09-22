// Adds the prompts of InMail's tones for someone who engaged with you, the same three First Message has
// (src/constants/inmail.ts):
//   "Post Interaction" and "Comment Interaction"  a thank-you sentence first, then a curiosity hook
//   "Viewed + Accepted"                           they viewed your profile and accepted your request, then a soft offer to help
// An InMail is a subject and a message, so each prompt asks for both; the opening sentence of the
// message is also put back in code (OPENING_LINES, lib/openingLine.ts) if a draft words it differently.
//
//   node scripts/add-inmail-interaction-tones.mjs                  adds the prompts (a prompt already there is left alone)
//   node scripts/add-inmail-interaction-tones.mjs --down           removes them again
//   node scripts/add-inmail-interaction-tones.mjs --down --force   removes them even after someone edited them
//
// Up only ever inserts, so running it twice changes nothing and no existing prompt or InMail is touched.
// Down deletes only these keys, and refuses a prompt whose text was edited in the app (content no
// longer the default) unless --force is given. InMails already written in these tones stay either way.

import { existsSync, readFileSync } from "node:fs"
import { MongoClient } from "mongodb"

const HUMAN_STYLE = `HUMAN STYLE (STRICT, NEVER BREAK THIS)
- Never use these symbols in the text you write: — (em dash), – (en dash), : (colon) or ; (semicolon). End the sentence and start a new one instead. Only a link or a time like 10:30 may contain a colon.
- Never use AI-sounding words such as seamless, seamlessly, robust, leverage, utilize, delve, elevate, unlock, empower, streamline, game-changer, cutting-edge, revolutionize, synergy, realm, tapestry or fast-paced. Use plain everyday words instead.
- Write like a real person typing on LinkedIn. Simple words, short sentences, no corporate buzzwords.
- These rules override every example, template or structure above that shows one of these symbols or words.`

// What every one of these subjects must be: about them, never about my post or the thanks
const SUBJECT_RULES = `SUBJECT LINE:
- 3 to 6 words, under 40 characters, sentence case, no trailing period.
- Name one concrete thing from their profile (their company, product, role or a project), the same thing the message builds on.
- Never mention my post, my comment, my profile, a thank you or a connection request in the subject. That belongs in the message.
- Never generic ("Quick question", "Hello", "Thanks", "Let's connect") and never clickbait.`

// The Curiosity Hook, with the thank-you sentence the message always opens with
const curiosityWithThanks = (opener, what) => `You are writing a LinkedIn InMail (a subject line and a message) to {{first_name}} at {{company}}, who recently interacted with my ${what}.

MESSAGE FRAMEWORK:
Hi {{first_name}}, ${opener}
[HOOK - Intrigue/Data]: {{intrigue_statement}}
[Why this matters]: {{context}}, tied to what they are working on.
[Question - Open loop]: {{open_question}}

EXAMPLE MESSAGE STRUCTURE:
Hi Tom, ${opener} I noticed that most teams building {{their_industry}} tools hit {{challenge}} once usage grows. Your work on {{project}} at {{company}} made me think of it. The pattern I keep seeing is [insight]. Are you running into this too?

${SUBJECT_RULES}

CRITICAL RULES:
- The message ALWAYS opens with exactly "Hi {{first_name}}, ${opener}" as its first line. Write that sentence word for word, then go straight into the hook.
- You do not know what my ${what} said or what it was about, so never name its topic, quote it or guess it. The thank-you sentence is the only mention of it.
- After the thank-you sentence, open the hook with an observation or a contrarian point about their field, taken from their profile.
- Leave an information gap, so they want to ask more.
- The LAST sentence of the message is ALWAYS one open question, ending with a question mark. Never end on a statement.
- NO PITCH. No offer of services, no call, no meeting, no calendar link.
- NO generic praise ("impressive company", "love your work").
- 60-90 words in the message, including the thank-you sentence.
- Conversational, one professional to another.

WHAT TO FILL IN:
{{first_name}} = Their first name
{{company}} = Their company
{{intrigue_statement}} = An observation about their field or work, from their profile
{{context}} = Why it matters to them now
{{open_question}} = One open question about their situation

Write ONLY the subject and the message. No meta-commentary.

${HUMAN_STYLE}`

// Someone who viewed my profile and accepted my connection request. It places {{sender_profile}}, so the
// app gives it my whole background, which is what the offer of help is built from.
const VIEWED_ACCEPTED = `You are writing a LinkedIn InMail (a subject line and a message) to {{first_name}}, who viewed my profile and then accepted my connection request.

MESSAGE FRAMEWORK:
Hi {{first_name}}, I noticed you viewed my profile and accepted my connection request.
[Their world]: One sentence on one specific thing from their profile (their role, company, product or a project) that shows I actually looked.
[How I could help]: One sentence on the one thing I do that fits what they are working on, taken from my own profile below. Said as help I could offer, never as a pitch.
[Soft offer]: One short open question offering help, such as whether there is anything on their side I could help with.

EXAMPLE MESSAGE STRUCTURE:
Hi Sara, I noticed you viewed my profile and accepted my connection request. Brightlane helping small retailers with logistics sounds like a lot of moving parts. I build web apps and automation for teams like that, so if anything on your side ever needs an extra pair of hands I am happy to help. Is there anything you are working on at the moment where that could be useful?

${SUBJECT_RULES}

CRITICAL RULES:
- The message ALWAYS opens with exactly "Hi {{first_name}}, I noticed you viewed my profile and accepted my connection request." Write that sentence word for word.
- Soft and professional. Warm, respectful and low pressure, one professional to another.
- Offer help, do not sell. No prices, no packages, no "we are the best", no "limited time", no "let's jump on a call", no meeting request, no calendar link.
- Say ONE sentence about me, and make it the offer of help itself, in plain words such as "I would be happy to help with..." or "I could help with...". Never list my experience, credentials, results or how many projects I have done.
- No urgency. Never say today, right now, quickly, asap or anything that rushes them.
- What I can help with comes ONLY from my own profile below. Never invent a service, a project, a client, a result or a number I have not written there. If my profile is empty, offer help in general words and name no service.
- The detail about them comes ONLY from their profile. Never guess why they viewed my profile.
- End the message with ONE open question ending with a question mark.
- 55-90 words in the message.
- NO generic praise ("impressive company", "love your work").

My profile:
{{sender_profile}}

Their profile:
{{profile_data}}

Write ONLY the subject and the message. No meta-commentary.

${HUMAN_STYLE}`

const PROMPTS = [
  {
    key: "inmail-post-interaction",
    tool: "inmail-message",
    content: curiosityWithThanks("thanks for interacting with my recent post.", "recent post"),
  },
  {
    key: "inmail-comment-interaction",
    tool: "inmail-message",
    content: curiosityWithThanks("thanks for interacting with my recent comment.", "recent comment"),
  },
  {
    key: "inmail-viewed-accepted",
    tool: "inmail-message",
    content: VIEWED_ACCEPTED,
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
