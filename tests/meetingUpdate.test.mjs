import test from "node:test"
import assert from "node:assert/strict"

// The route reads config/env.ts as it loads, so the checker has something valid to read. Nothing
// here connects to anything: only the shape of what an update accepts is being checked.
process.env.NEXT_PUBLIC_BASE_URL ??= "http://localhost:3000"
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/tests"
process.env.AUTH_SECRET ??= "a-test-secret-that-is-long-enough-32"

const load = (await import("./load.mjs")).default
const { MeetingInputSchema } = load("app/api/meeting-planner/route.ts")
const { UpdateSchema } = load("app/api/meeting-planner/[id]/route.ts")

test("a change that says nothing about preparation leaves preparation alone", () => {
  // Ticking a meeting off sends the status and nothing else
  const status = UpdateSchema.parse({ status: "completed" })
  assert.equal("prepEnabled" in status, false, "an update with no word about preparation must not carry one")

  // The same for every other small change, such as saving a profile link on its own
  const link = UpdateSchema.parse({ profileLink: "https://linkedin.com/in/omar" })
  assert.equal("prepEnabled" in link, false)
  assert.equal(link.profileLink, "https://linkedin.com/in/omar", "the change itself still goes through")
})

test("preparation is still switched on and off when the change actually says so", () => {
  assert.equal(UpdateSchema.parse({ prepEnabled: true }).prepEnabled, true)
  assert.equal(UpdateSchema.parse({ prepEnabled: false }).prepEnabled, false)
})

test("a new meeting still defaults to no preparation when it says nothing", () => {
  const created = MeetingInputSchema.parse({ name: "Intro call", meetingDate: "2026-09-18", meetingTime: "14:37" })
  assert.equal(created.prepEnabled, false, "creating is where the default belongs")
  assert.equal(created.profileLink, null, "and a meeting with no link has none")
})

test("an update has to change something", () => {
  assert.equal(UpdateSchema.safeParse({}).success, false)
})

test("the profile link is made into a web address, and a link that is not one is refused", () => {
  assert.equal(UpdateSchema.parse({ profileLink: "linkedin.com/in/omar" }).profileLink, "https://linkedin.com/in/omar")
  assert.equal(UpdateSchema.parse({ profileLink: "" }).profileLink, null, "emptying it takes it off the meeting")
  assert.equal(UpdateSchema.safeParse({ profileLink: "javascript:alert(1)" }).success, false)
  assert.equal(UpdateSchema.safeParse({ profileLink: `https://x.example/${"a".repeat(600)}` }).success, false, "and one absurdly long is refused")
})

test("a meeting can be moved to any minute of the hour", () => {
  for (const time of ["09:07", "14:38", "00:01", "23:59"]) {
    assert.equal(UpdateSchema.parse({ meetingTime: time }).meetingTime, time)
  }
  assert.equal(UpdateSchema.safeParse({ meetingTime: "09:60" }).success, false)
})
