import test from "node:test"
import assert from "node:assert/strict"
import load from "./load.mjs"

const { conversationOf, newStage, newStep } = load("lib/meetingScript.ts")
const { ConversationScriptSchema } = load("lib/validation/meetingScript.ts")

test("a preparation written before scripts reads as say, ask, listen and a closing say", () => {
  const stages = conversationOf({
    conversation_plan: [
      {
        stage: "Opening",
        goal: "Build rapport",
        what_to_say: "Thanks for your time.",
        questions: ["How is your week?", "What made you reach out?"],
        move_on_when: "They are relaxed",
        transition: "Let me ask about the project.",
      },
    ],
  })
  assert.equal(stages.length, 1)
  assert.equal(stages[0].title, "Opening")
  assert.equal(stages[0].move_on_when, "They are relaxed")
  assert.deepEqual(
    stages[0].steps.map((step) => step.kind),
    ["say", "ask", "ask", "listen", "say"]
  )
  assert.equal(stages[0].steps[1].text, "How is your week?")
})

test("a script is read as it was saved", () => {
  const conversation = [newStage("Opening")]
  assert.equal(conversationOf({ conversation, conversation_plan: [] }), conversation)
})

test("new steps and stages get their own ids, and only a project step gets minutes", () => {
  const say = newStep("say")
  const show = newStep("show_project")
  assert.notEqual(say.id, show.id)
  assert.equal(say.minutes, 0)
  assert.ok(show.minutes > 0)
  assert.equal(newStage().steps.length, 1)
})

test("an edited script is accepted, and a stage without a title or a repeated id is refused", () => {
  const stage = { ...newStage("Opening"), steps: [newStep("say", "Hello"), { ...newStep("show_project", "This is it"), project: "Okani Travels", features: ["AI pricing engine"] }] }
  assert.equal(ConversationScriptSchema.safeParse({ stages: [stage] }).success, true)
  assert.equal(ConversationScriptSchema.safeParse({ stages: [{ ...stage, title: "  " }] }).success, false)
  assert.equal(ConversationScriptSchema.safeParse({ stages: [stage, { ...stage }] }).success, false)
  assert.equal(ConversationScriptSchema.safeParse({ stages: [{ ...stage, steps: [{ ...stage.steps[0], kind: "shout" }] }] }).success, false)
})

const { projectsOf, normalizeProjectLink, projectLinksOf } = load("lib/meetingScript.ts")
const { ProjectsToShowSchema } = load("lib/validation/meetingScript.ts")

test("projects saved before links existed read with an id, no link and as suggested", () => {
  const [project] = projectsOf({ projects_to_show: [{ project: "Okani Travels", why_it_will_land: "Booking" }] })
  assert.ok(project.id)
  assert.equal(project.link, "")
  assert.equal(project.added_by_user, false)
})

test("a typed link becomes a web address, and links are found by project name", () => {
  assert.equal(normalizeProjectLink(" rafaydev.vercel.app "), "https://rafaydev.vercel.app")
  assert.equal(normalizeProjectLink("http://example.com"), "http://example.com")
  assert.equal(normalizeProjectLink("  "), "")
  assert.deepEqual(projectLinksOf([{ project: " Okani Travels ", why_it_will_land: "", link: "https://okani.com" }, { project: "No link", why_it_will_land: "" }]), {
    "okani travels": "https://okani.com",
  })
})

test("a project needs a name, and its link must be a web address or empty", () => {
  const project = { id: "p1", project: "GenX Career", why_it_will_land: "", link: "", added_by_user: true }
  assert.equal(ProjectsToShowSchema.safeParse({ projects: [project] }).success, true)
  assert.equal(ProjectsToShowSchema.safeParse({ projects: [{ ...project, link: "https://genx.example" }] }).success, true)
  assert.equal(ProjectsToShowSchema.safeParse({ projects: [{ ...project, link: "javascript:alert(1)" }] }).success, false)
  assert.equal(ProjectsToShowSchema.safeParse({ projects: [{ ...project, project: " " }] }).success, false)
})
