import test from "node:test"
import assert from "node:assert/strict"
import load from "./load.mjs"

const { findProfileLink, normalizeProfileLink, isUsableProfileLink } = load("lib/profileLink.ts")

test("a profile pasted in whole gives up the person's own address", () => {
  const pasted = `Omar Siddiqui
Head of Product at Fleetly
https://www.linkedin.com/in/omar-siddiqui/
Lahore, Pakistan`
  assert.equal(findProfileLink(pasted), "https://www.linkedin.com/in/omar-siddiqui/")
})

test("the person's profile wins over any other link in the same paste", () => {
  const pasted = `Omar Siddiqui
Company site: https://fleetly.io
Our blog: https://fleetly.io/blog/why-we-built-this
Profile: https://linkedin.com/in/omar-siddiqui`
  assert.equal(findProfileLink(pasted), "https://linkedin.com/in/omar-siddiqui", "the company site does not win")
})

test("a link copied without its scheme is still a link", () => {
  assert.equal(findProfileLink("Find him at www.linkedin.com/in/omar"), "https://www.linkedin.com/in/omar")
  assert.equal(normalizeProfileLink("linkedin.com/in/omar"), "https://linkedin.com/in/omar")
  assert.equal(normalizeProfileLink("https://linkedin.com/in/omar"), "https://linkedin.com/in/omar", "one already made stays as it is")
  assert.equal(normalizeProfileLink("   "), "", "blank stays blank")
})

test("the punctuation around a link in a sentence is not part of it", () => {
  assert.equal(findProfileLink("His profile (https://github.com/omar) is worth a look."), "https://github.com/omar")
  assert.equal(findProfileLink("See https://github.com/omar."), "https://github.com/omar")
})

test("a paste with no link at all gives nothing, and never guesses", () => {
  assert.equal(findProfileLink("Omar Siddiqui, Head of Product at Fleetly, Lahore."), "")
  assert.equal(findProfileLink(""), "")
  assert.equal(findProfileLink(null), "")
  assert.equal(findProfileLink(undefined), "")
})

test("a site of their own is taken when there is no profile host in the paste", () => {
  assert.equal(findProfileLink("Omar Siddiqui — https://omarsiddiqui.dev"), "https://omarsiddiqui.dev")
})

test("only a web address the page can open counts as usable", () => {
  assert.equal(isUsableProfileLink("https://linkedin.com/in/omar"), true)
  assert.equal(isUsableProfileLink("http://example.com"), true)
  // Anything that is not http(s) is never opened from the meeting
  assert.equal(isUsableProfileLink(normalizeProfileLink("javascript:alert(1)")), false)
  assert.equal(isUsableProfileLink(normalizeProfileLink("mailto:omar@example.com")), false)
})

test("a script link hiding in a pasted profile is never taken as the profile", () => {
  assert.equal(findProfileLink("Profile: javascript:alert(1)"), "", "it is not a web address, so it is not a link")
})
