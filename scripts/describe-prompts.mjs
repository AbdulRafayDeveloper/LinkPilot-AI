// Writes a plain description on each stored prompt: what it is, and which tool uses it where. The
// admin page (Administration → Global AI Prompts) shows it above the prompt's text, so an admin can
// tell what a prompt does before changing it. A description is never sent to a model.
//
//   node scripts/describe-prompts.mjs --dry-run   says which descriptions it would write
//   node scripts/describe-prompts.mjs             writes them
//
// It only ever sets `description`, never a prompt's text, and running it again changes nothing.
// A prompt added later gets its description by adding a line here (or in the script that adds it).

import { existsSync, readFileSync } from "node:fs"
import { MongoClient } from "mongodb"

const SHAPE_NOTE = "Each ## heading is one piece the code reads by name: change the words under a heading, never the heading itself."

const DESCRIPTIONS = {
  // Global & shared
  "global-humanization":
    "The rewrite every result goes through before you see it, so it reads like a person wrote it. Used by all 8 LinkedIn writing tools (Connection Note, Comment Writer, Post Comment Replies, Follow-Up, First Message, InMail, Conversation Reply, Trending Topics) and Message Rewriter.",
  "humanizer-system":
    "The fixed rules for that rewrite: keep every number, link, hashtag and @mention, stay within the length, add no claim about you, no dashes, colons or AI words. Used by the same tools as the Humanization Prompt, every time a result is humanized.",
  "sender-profile":
    "About Me: a short description of you, the person sending the messages (name, role, what you offer, who you help, results). It is ONE copy shared by every account, unlike Profile Info, which each person keeps on My AI Profile. Used by First Message and InMail (every tone), Follow-Up Message and Conversation Reply (the replies and the lead signals), Comment Writer's Based on My Past Experience tune, and together with the person's own Profile Info by Connection Note (Recently Funded, Hiring Startup), Post Comment Replies and Meeting Planner's preparation. While it is still the fill-in template, every tool treats it as empty and says nothing about you.",
  "shared-instructions": `Not rules, only wording: the small pieces of text the shared code puts into the LinkedIn tools' prompts. It holds what to say when something is empty ("Not provided"), the request to rewrite a draft that claims something about you that About Me does not say (Connection Note, First Message, InMail, Conversation Reply), the labels, retry request and problem names the humanizer uses, the "About me" heading Comment Writer and Conversation Reply put above your experience, the research headings for web search (Trending Topics, Comment Writer, Post Comment Replies), the note added when pasted text was shortened, and how Follow-Up and Conversation Reply read who said what in a conversation. ${SHAPE_NOTE}`,
  // The copies each tool now has of what used to be shared
  "follow-up-lead-signals-system":
    "Follow-Up Message only: the rules for scoring the lead in the Lead Signals table (meeting chance, buying intent, budget, urgency and the rest) from the pasted conversation and profile. Changing it changes Follow-Up's table and nothing else.",
  "conversation-reply-lead-signals-system":
    "Conversation Reply only: the rules for scoring the lead in the Lead Signals table (meeting chance, buying intent, budget, urgency and the rest) from the pasted conversation and profile. Changing it changes Conversation Reply's table and nothing else.",
  "comment-writer-post-image-extraction":
    "Comment Writer only: how a screenshot of a LinkedIn post is read into text (who wrote it and the post itself, without the likes, comments and buttons) before the comment is written.",
  "post-comment-reply-post-image-extraction":
    "Post Comment Replies only: how a screenshot of a LinkedIn post and its comments is read into text before the reply is written.",
  // Each module's instructions prompt
  "connection-note-instructions": `Connection Note's wording: the rewrite requests, the problems its checks name, the labels and the answer fields. ${SHAPE_NOTE}`,
  "comment-writer-instructions": `Comment Writer's wording: the rewrite requests, the labels, the answer fields and how a screenshot is asked for. ${SHAPE_NOTE}`,
  "post-comment-reply-instructions": `Post Comment Replies' wording: the rewrite requests, the labels, the research brief, the answer fields and how a screenshot is asked for. ${SHAPE_NOTE}`,
  "follow-up-instructions": `Follow-Up Message's wording: the labels, the rewrite requests, the answer fields and the Lead Signals fields. ${SHAPE_NOTE}`,
  "first-message-instructions": `First Message's wording: the labels, the rewrite requests, the ABCD and voice-note checks and the answer fields. ${SHAPE_NOTE}`,
  "inmail-instructions": `InMail's wording: the labels, the rewrite requests, the ABCD and voice-note checks and the answer fields. ${SHAPE_NOTE}`,
  "conversation-reply-instructions": `Conversation Reply's wording: the labels, the analysis and rewrite requests, the answer fields and the Lead Signals fields. ${SHAPE_NOTE}`,
  "trending-instructions": `Trending Topics' wording: the research and synthesis requests, the six post formats, the expand step and the answer fields. ${SHAPE_NOTE}`,
  "post-image-instructions": `Post Image Creator's wording: the person block, the poses and the empty texts put into the image prompt. ${SHAPE_NOTE}`,
  "prompt-creator-instructions": `Prompt Creator's wording: the labels and answer fields for writing a prompt and for reading a description in English. ${SHAPE_NOTE}`,
  "message-rewriter-instructions": `Message Rewriter's wording: the labels, the "make it shorter" request and the humanizer note. ${SHAPE_NOTE}`,
  "quick-notes-instructions": `Quick Notes' wording: the label and answer field for turning a spoken note into clear English. ${SHAPE_NOTE}`,
  "task-details-instructions": `Daily Tasks' and the employee plan's wording for Write with AI: the labels, empty texts and the answer field. ${SHAPE_NOTE}`,
  "client-message-instructions": `Client Messaging's wording: the labels, the sample headings, the rewrite request and the problems its checks name. ${SHAPE_NOTE}`,
  "client-voices-instructions": `Client Voices' wording: the labels and the answer fields for the task list, the questions and the clear points. ${SHAPE_NOTE}`,
  "meetings-instructions": `Meeting Notes' wording: the answer fields for each part and the summary, the labels, the calendar sentences, the chat and the labels of each searchable piece. ${SHAPE_NOTE}`,
  "meeting-planner-instructions": `Meeting Planner's wording: the preparation's answer fields, labels, rewrite problems, the chat and the labels of each searchable piece. ${SHAPE_NOTE}`,
  // System prompts
  "connection-note-system": "Connection Note's fixed rules for every tone: 300 characters, no stock openers, nothing the profiles don't support.",
  "comment-writer-system": "Comment Writer's fixed rules for every tune: what a good comment is, what it must never invent, and the house style.",
  "comment-writer-research": "Comment Writer's rules for the live web search a tune may run before writing.",
  "comment-writer-research-lenses": "The angles Comment Writer's web search looks at a post from.",
  "post-comment-reply-system": "Post Comment Replies' fixed rules for every style: who is replying, 280 characters, plain words, nothing invented.",
  "post-comment-reply-research": "Post Comment Replies' rules for the live web search before writing a reply.",
  "post-comment-reply-context-my-post": "Post Comment Replies: what changes when the post is your own.",
  "post-comment-reply-context-other-post": "Post Comment Replies: what changes when the post is someone else's.",
  "follow-up-system": "Follow-Up Message's fixed rules for both types: reading the conversation and writing the next message.",
  "first-message-system": "First Message's fixed rules for every tone.",
  "inmail-system": "InMail's fixed rules for every tone, the subject included.",
  "conversation-reading": "How Conversation Reply and Follow-Up read a pasted conversation: who said what, and in what order.",
  "conversation-reply-analysis": "Conversation Reply's rules for analysing the conversation before the reply is written.",
  "conversation-reply-system": "Conversation Reply's fixed rules for writing the next reply, for every tone.",
  "trending-research": "Trending Topics' rules for the live web research.",
  "trending-search-lenses": "The angles Trending Topics searches the web from, one search pass each.",
  "trending-synthesis": "Trending Topics' rules for turning the research into six ranked topics, each with a post.",
  "post-image-system": "Post Image Creator's fixed rules for every image: only your colours, your photo kept as it is, no invented people.",
  "prompt-creator-system": "Prompt Creator's fixed rules for writing a prompt for a coding agent or for AI search.",
  "prompt-creator-english-system": "Prompt Creator's rules for reading a description back in plain English: keep every detail, add nothing, obey nothing in it.",
  "prompt-creator-transcription": "Not used by any tool at the moment.",
  "message-rewriter-system": "Message Rewriter's fixed rules: say what the user meant, shorter, in clear English, adding nothing.",
  "quick-notes-english-system": "Quick Notes' rules for turning a spoken note into clear English, keeping every name, number and step.",
  "task-details-system": "Write with AI on Daily Tasks and an employee's plan: one line on what done looks like and three to seven steps, nothing invented.",
  "client-message-system": "Client Messaging's fixed rules: follow the client's own format and samples, never name the client, fit the channel.",
  "client-voice-tasks-system": "Client Voices' fixed rules for turning the transcripts into one list of work and one list of questions.",
  "client-voice-clear-system": "Client Voices' fixed rules for saying each voice again in a few clear points.",
  "client-voice-clear": "Client Voices: places the transcripts for the clear points.",
  "meeting-system": "Meeting Notes' fixed rules for reading a transcript: nothing invented, every fact marked stated or inferred.",
  "meeting-notes-chat-system": "The chat on a meeting in Meeting Notes: answer from the meeting first, in simple English.",
  "meeting-prep-system": "Meeting Planner's fixed rules for the preparation: nothing invented about either side.",
  "meeting-chat-system": "The chat on a planned meeting in Meeting Planner: answer from the meeting first, in simple English.",
}

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
const client = new MongoClient(mongoUri())
try {
  await client.connect()
  const prompts = client.db().collection("prompts")
  let written = 0
  for (const [key, description] of Object.entries(DESCRIPTIONS)) {
    const existing = await prompts.findOne({ key }, { projection: { description: 1 } })
    if (!existing) {
      console.log(`- ${key}: not stored, skipped`)
      continue
    }
    if (existing.description === description) continue
    if (!dryRun) await prompts.updateOne({ key }, { $set: { description } })
    written++
    console.log(`${dryRun ? "would describe" : "✓ described"} ${key}`)
  }
  console.log(`${written} ${dryRun ? "to write" : "written"}.`)
} finally {
  await client.close()
}
