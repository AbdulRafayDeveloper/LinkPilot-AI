// Adds the prompts of the tones for someone who engaged with you (your post, your comment, your profile):
//   Connection Note  "Post Interaction" and "Post Comment"        (src/constants/connectionNote.ts)
//   First Message    "Post Interaction", "Comment Interaction" and "Viewed + Accepted" (src/constants/firstMessage.ts):
//                    the first two are the Curiosity Hook prompt with a thank-you sentence first
// A tone is an entry in its constants file plus its own prompt document; the entries are in the
// code, and this writes the documents, since prompts live only in the database.
//
//   node scripts/add-thanks-tones.mjs                  adds the prompts (a prompt already there is left alone)
//   node scripts/add-thanks-tones.mjs --down           removes them again
//   node scripts/add-thanks-tones.mjs --down --force   removes them even after someone edited them
//
// Up only ever inserts, so running it twice changes nothing and no existing prompt or message is
// touched. Down deletes only these keys, and refuses a prompt whose text was edited in the app
// (content no longer the default) unless --force is given, so nobody's changes go by accident.
// Notes and messages already written in these tones stay where they are either way.

import { existsSync, readFileSync } from "node:fs"
import { MongoClient } from "mongodb"


const HUMAN_STYLE = `HUMAN STYLE (STRICT, NEVER BREAK THIS)
- Never use these symbols in the text you write: — (em dash), – (en dash), : (colon) or ; (semicolon). End the sentence and start a new one instead. Only a link or a time like 10:30 may contain a colon.
- Never use AI-sounding words such as seamless, seamlessly, robust, leverage, utilize, delve, elevate, unlock, empower, streamline, game-changer, cutting-edge, revolutionize, synergy, realm, tapestry or fast-paced. Use plain everyday words instead.
- Write like a real person typing on LinkedIn. Simple words, short sentences, no corporate buzzwords.
- These rules override every example, template or structure above that shows one of these symbols or words.`

// The Curiosity Hook prompt, with the thank-you sentence the tone always opens with. The sentence is
// also put back in code (OPENING_LINES, lib/openingLine.ts) if a draft words it differently.
const curiosityWithThanks = (opener, what) => `You are generating a curiosity-hook LinkedIn first message for {{first_name}} at {{company}}, who recently interacted with my ${what}.

FRAMEWORK:
Hi {{first_name}}, ${opener}
[HOOK - Intrigue/Data]: {{intrigue_statement}}
[Why this matters]: When I was working with {{similar_company_type}}, {{context}}.
[Question - Open loop]: {{open_question}}

EXAMPLE STRUCTURE:
Hi Tom, ${opener} I noticed that most B2B companies building {{their_industry}} struggle with {{challenge}}. When I looked at your work at {{company}}, it seems you're [specific thing they're doing]. I've been seeing a pattern across 50+ companies: [insight]. Curious, are you running into this too?

---

CRITICAL RULES:
- The message ALWAYS opens with exactly "Hi {{first_name}}, ${opener}" as its first line. Write that sentence word for word, then go straight into the hook.
- You do not know what my ${what} said or what it was about, so never name its topic, quote it or guess it. The thank-you sentence is the only mention of it.
- After the thank-you sentence, open the hook with a DATA DROP or CONTRARIAN STATEMENT (not "Hey, how's it going")
- Leave information gap = they want to ask more = curiosity wins
- Question at end (50% more likely to get response than statement)
- The LAST sentence is ALWAYS that question, ending with a question mark. Never end on a statement such as "I am curious how you handle this."
- NO PITCH in first message
- NO generic praise ("impressive company", "love your work")
- 60-85 words total including the thank-you sentence (350-480 characters)
- Conversational tone (one professional to another)

WHAT TO FILL IN:
{{first_name}} = Their first name
{{company}} = Their company
{{intrigue_statement}} = Data point or observation (e.g., "I noticed 73% of {{industry}} leaders...")
{{similar_company_type}} = Company type/stage they work at
{{context}} = Brief situation/lesson learned
{{open_question}} = Open-ended question about their situation

Write ONLY the message. No meta-commentary.

${HUMAN_STYLE}`

const shared = (who) => `PERSONALIZATION:

* Use the person's first name exactly once at the beginning.
* Add one slight personal touch from their profile: their current role, company, field or a specific project. One detail only, mentioned naturally.
* The personal touch must come from the profile below. Never invent or assume anything that is not stated there.
* You do not know what the post was about, so never name its topic or quote it. Refer to it only as "my post".
* ${who}

LENGTH:

* Maximum 190 characters including spaces.
* Aim for approximately 140 to 180 characters.
* Keep it to 1 or 2 short sentences.

TONE:

* Professional, warm, grateful and respectful.
* Natural and conversational, like a real person saying thanks.
* Simple and direct language.
* Do not sound like a sales message or an automated LinkedIn template.
* No flattery and no generic praise that could apply to anyone.

AVOID:

* "I came across your profile"
* "I would love to connect"
* "I would love to add you to my network"
* "Your journey is inspiring"
* "It is great to see"
* Selling, pitching or offering services
* Asking for a call, a meeting, a job, a referral or a favor
* Questions that create pressure
* Emojis, hashtags and sign-offs
* Exclamation marks
* Filler words such as really, truly, genuinely or especially, above all tacked onto the end of a sentence

NATURAL WRITING:

* Do not put a comma after the person's name.
* Avoid unnecessary commas.
* Do not use contractions.
* Use punctuation naturally and minimally.`

// Someone who viewed my profile and accepted my connection request. It places {{sender_profile}}, so
// the app gives it my whole background (About Me plus Rafay Profile Info), which is what the offer of
// help is built from. The opening sentence is also put back in code (OPENING_LINES).
const VIEWED_ACCEPTED = `You are writing my first LinkedIn message to {{first_name}}, who viewed my profile and then accepted my connection request.

FRAMEWORK:
Hi {{first_name}}, I noticed you viewed my profile and accepted my connection request.
[Their world]: One sentence on one specific thing from their profile (their role, company, product or a project) that shows I actually looked.
[How I could help]: One sentence on the one thing I do that fits what they are working on, taken from my own profile below. Said as help I could offer, never as a pitch.
[Soft offer]: One short open question offering help, such as whether there is anything on their side I could help with, or whether that is something they are thinking about.

EXAMPLE STRUCTURE:
Hi Sara, I noticed you viewed my profile and accepted my connection request. Brightlane helping small retailers with logistics sounds like a lot of moving parts. I build web apps and automation for teams like that, so if anything on your side ever needs an extra pair of hands I am happy to help. Is there anything you are working on at the moment where that could be useful?

---

CRITICAL RULES:
- The message ALWAYS opens with exactly "Hi {{first_name}}, I noticed you viewed my profile and accepted my connection request." Write that sentence word for word.
- Soft and professional. Warm, respectful and low pressure, one professional to another.
- Offer help, do not sell. No prices, no packages, no "we are the best", no "limited time", no "let's jump on a call", no meeting request, no calendar link.
- Say ONE sentence about me, and make it the offer of help itself, in plain words such as "I would be happy to help with..." or "I could help with...". Never list my experience, credentials, results or how many projects I have done.
- No urgency. Never say today, right now, quickly, asap or anything that rushes them.
- What I can help with comes ONLY from my own profile below. Never invent a service, a project, a client, a result or a number I have not written there. If my profile is empty, offer help in general words and name no service.
- The detail about them comes ONLY from their profile. Never guess why they viewed my profile.
- End with ONE open question ending with a question mark.
- 55-85 words total (330-500 characters).
- NO generic praise ("impressive company", "love your work").

My profile:
{{sender_profile}}

Their profile:
{{profile_data}}

Write ONLY the message. No meta-commentary.

${HUMAN_STYLE}`

const PROMPTS = [
  {
    key: "first-message-viewed-accepted",
    tool: "first-message",
    content: VIEWED_ACCEPTED,
  },
  {
    key: "first-message-post-interaction",
    tool: "first-message",
    content: curiosityWithThanks("thanks for interacting with my recent post.", "recent post"),
  },
  {
    key: "first-message-comment-interaction",
    tool: "first-message",
    content: curiosityWithThanks("thanks for interacting with my recent comment.", "recent comment"),
  },
  {
    key: "connection-note-post-interaction",
    tool: "connection-note",
    content: `Write a short LinkedIn connection note thanking this person for interacting with my post, based only on the profile provided below.

GOAL:
They reacted to or shared one of my LinkedIn posts. Thank them for it and start a genuine professional connection. The note must say "thank you for interacting with my post" in natural words and feel personally written for them.

${shared(`The thanks comes first, right after their name ("Sara thank you for interacting with my post..."), then the personal touch.`)}

FINAL CHECK:
Before returning the note silently verify:

1. The first name appears exactly once and is at the beginning, with no comma after it.
2. The note thanks them for interacting with my post.
3. It has one slight personal touch taken from the profile, and nothing invented.
4. It never names or guesses what the post was about.
5. There is no selling or ask.
6. There are no emojis, hashtags, sign-offs or contractions.
7. The total length is 190 characters or fewer including spaces.

Return ONLY the final LinkedIn connection note.

Profile:
{{profile_data}}

${HUMAN_STYLE}`,
  },
  {
    key: "connection-note-post-comment",
    tool: "connection-note",
    content: `Write a short LinkedIn connection note thanking this person for commenting on my post, based only on the profile provided below.

GOAL:
They left a comment on one of my LinkedIn posts. Thank them for taking the time to comment and share their view, and start a genuine professional connection. It should feel personally written for them.

${shared(`The thanks comes first, right after their name ("Sara thank you for commenting on my post..."), then the personal touch, for example that their view means more coming from someone in their role or field.`)}

FINAL CHECK:
Before returning the note silently verify:

1. The first name appears exactly once and is at the beginning, with no comma after it.
2. The note thanks them for commenting on my post.
3. It has one slight personal touch taken from the profile, and nothing invented.
4. It never names or guesses what the post or the comment said.
5. There is no selling or ask.
6. There are no emojis, hashtags, sign-offs or contractions.
7. The total length is 190 characters or fewer including spaces.

Return ONLY the final LinkedIn connection note.

Profile:
{{profile_data}}

${HUMAN_STYLE}`,
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
