import test from "node:test"
import assert from "node:assert/strict"
import load from "./load.mjs"

const { meetingChunks } = load("lib/meetingChunks.ts")
const { CHUNK_MAX_CHARS } = load("constants/meetingChat.ts")

const meeting = (extra = {}) => ({
  id: "meeting-1",
  name: "Intro call",
  meetingDate: "2026-09-25",
  meetingTime: "17:30",
  status: "pending",
  personName: "Michael Grove",
  profileInfo: null,
  conversationHistory: null,
  additionalInfo: null,
  prep: null,
  ...extra,
})

const prep = {
  lead_analysis: {
    who_they_are: "Founder at HumanCentric Labs",
    background: "Ten years in operations software",
    interests: [{ point: "Agent frameworks", evidence: "stated" }],
    needs_and_opportunities: [{ point: "Needs a working prototype", evidence: "inferred" }],
    how_you_can_help: ["Build the first version"],
    before_you_join: ["Read their site"],
    open_questions: ["What is the deadline?"],
  },
  discussion_topics: [
    { topic: "Their agent system", why_it_matters: "It is the project", evidence: "stated" },
    { topic: "Timeline", why_it_matters: "Decides the scope", evidence: "inferred" },
  ],
  conversation: [
    { id: "s1", title: "Opening and rapport", goal: "Greet Michael", move_on_when: "He has said what he needs", steps: [{ id: "a", kind: "say", text: "Hi Michael", project: "", minutes: 0, features: [] }] },
    { id: "s2", title: "Their situation", goal: "Understand the work", move_on_when: "", steps: [{ id: "b", kind: "show_project", text: "Open the demo", project: "LinkPilot", minutes: 5, features: ["Trending"] }] },
  ],
  projects_to_show: [{ project: "LinkPilot", why_it_will_land: "Same problem, already built", link: "https://example.test" }],
  deal_path: { signals_to_listen_for: ["Budget mentioned"], how_to_raise_scope: "Ask about phase two", natural_next_step: "A paid discovery week" },
  cautions: ["Never claim a client you don't have"],
}

test("a meeting with nothing saved still gives its own details to answer from", () => {
  const chunks = meetingChunks(meeting())
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0].kind, "meeting")
  assert.match(chunks[0].text, /Intro call/)
  assert.match(chunks[0].text, /Michael Grove/)
  assert.match(chunks[0].text, /2026-09-25 at 17:30/)
})

test("what the user supplied becomes its own pieces, named for the user", () => {
  const chunks = meetingChunks(meeting({ profileInfo: "Michael runs HumanCentric Labs.", conversationHistory: "He asked for a call.", additionalInfo: "Keep it short." }))
  const kinds = chunks.map((chunk) => chunk.kind)
  assert.deepEqual(kinds, ["meeting", "profile", "conversation-history", "notes"])
  assert.equal(chunks[1].label, "Their profile")
  assert.equal(chunks[2].label, "Conversation so far")
  assert.equal(chunks[3].label, "Your notes")
})

test("long text is cut into pieces that each stand on their own, and each says which piece it is", () => {
  const paragraph = "Michael has run operations software for ten years and wants an agent system. ".repeat(60)
  const chunks = meetingChunks(meeting({ profileInfo: paragraph }))
  const profile = chunks.filter((chunk) => chunk.kind === "profile")
  assert.ok(profile.length > 1, `expected several pieces, got ${profile.length}`)
  for (const piece of profile) {
    assert.ok(piece.text.length <= CHUNK_MAX_CHARS, `piece of ${piece.text.length} characters`)
    assert.match(piece.label, /^Their profile \(\d+ of \d+\)$/)
  }
  // Every word of the profile is still somewhere in the pieces
  assert.ok(profile.some((piece) => piece.text.startsWith("Michael has run operations")))
})

test("every part of a preparation becomes pieces an answer can name", () => {
  const chunks = meetingChunks(meeting({ prep }))
  const byKind = (kind) => chunks.filter((chunk) => chunk.kind === kind)
  assert.equal(byKind("lead-analysis").length, 1)
  assert.equal(byKind("topics").length, 2)
  assert.equal(byKind("conversation").length, 2)
  assert.equal(byKind("projects").length, 1)
  assert.equal(byKind("deal-path").length, 1)
  assert.equal(byKind("cautions").length, 1)
  assert.equal(byKind("conversation")[0].label, "Stage 1. Opening and rapport")
  assert.equal(byKind("topics")[1].label, "Topic 2. Timeline")
  assert.match(byKind("lead-analysis")[0].text, /Still unknown, so ask:\n- What is the deadline\?/)
  // A step that shows a project keeps the project, the minutes and the features with it
  assert.match(byKind("conversation")[1].text, /LinkPilot.*5 minutes.*Trending/s)
  assert.match(byKind("projects")[0].text, /https:\/\/example\.test/)
})

test("nothing is empty, because an empty piece would be a wasted search result", () => {
  const chunks = meetingChunks(meeting({ profileInfo: "   ", additionalInfo: "", prep }))
  for (const chunk of chunks) assert.ok(chunk.text.trim().length > 0, `${chunk.kind} is empty`)
  assert.equal(chunks.some((chunk) => chunk.kind === "profile"), false)
})
