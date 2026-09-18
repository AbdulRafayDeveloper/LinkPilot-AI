import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import load from "./load.mjs"

const { toolIdForApiPath, toolIdForPagePath, isFeatureDisabled } = load("lib/featureAccess.ts")
const { FEATURE_API_PATHS, SHARED_API_PATHS, manageableFeatures } = load("constants/featureAccess.ts")
const { APP_TOOLS, toolsFor } = load("constants/linkedinTools.ts")

const user = (disabledTools = []) => ({ role: "user", disabledTools })
const admin = (disabledTools = []) => ({ role: "admin", disabledTools })

test("every tool an admin can turn off says which API is its own", () => {
  const missing = manageableFeatures()
    .map((tool) => tool.id)
    .filter((id) => !FEATURE_API_PATHS[id])
  assert.deepEqual(missing, [], `these tools have no API path, so turning them off would not refuse anything: ${missing.join(", ")}`)
})

test("every API folder is either a tool's or named as shared, so no route escapes the gate", () => {
  const apiRoot = path.resolve("src/app/api")
  const folders = fs
    .readdirSync(apiRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `/api/${entry.name}`)
  const claimed = new Set([...Object.values(FEATURE_API_PATHS).flat(), ...SHARED_API_PATHS])
  const orphans = folders.filter((folder) => !claimed.has(folder))
  assert.deepEqual(
    orphans,
    [],
    `these API folders belong to no tool and are not listed as shared, so a tool turned off would still reach them: ${orphans.join(", ")}`
  )
})

test("every API path claimed by a tool is a folder that really exists", () => {
  const apiRoot = path.resolve("src/app/api")
  const wrong = Object.entries(FEATURE_API_PATHS).flatMap(([toolId, paths]) =>
    paths.filter((p) => !fs.existsSync(path.join(apiRoot, p.replace("/api/", "")))).map((p) => `${toolId} -> ${p}`)
  )
  assert.deepEqual(wrong, [], `these point at API folders that do not exist: ${wrong.join(", ")}`)
})

test("an API path is matched to the tool it belongs to", () => {
  assert.equal(toolIdForApiPath("/api/daily-tasks"), "daily-tasks")
  assert.equal(toolIdForApiPath("/api/daily-tasks/abc123/move"), "daily-tasks")
  assert.equal(toolIdForApiPath("/api/connection-notes/generate"), "connection-note")
  assert.equal(toolIdForApiPath("/api/quick-notes/xyz"), "quick-notes")
})

test("a longer folder name that merely starts the same is not the same tool", () => {
  // /api/meetings must not swallow /api/meeting-planner
  assert.equal(toolIdForApiPath("/api/meeting-planner/1/prepare"), "meeting-planner")
  assert.equal(toolIdForApiPath("/api/meetings/1"), "meetings")
})

test("the shared routes belong to no tool, so turning tools off never blocks signing in", () => {
  for (const shared of ["/api/auth/login", "/api/auth/me", "/api/admin/users", "/api/ai-status", "/api/transcribe", "/api/public/plans/token"]) {
    assert.equal(toolIdForApiPath(shared), null, `${shared} should belong to no tool`)
  }
})

test("a view-all route names its tool in the path", () => {
  assert.equal(toolIdForApiPath("/api/saved-outputs/connection-note"), "connection-note")
  assert.equal(toolIdForApiPath("/api/saved-outputs/prompt-creator/abc"), "prompt-creator")
})

test("a page path is matched to its tool, and the longest match wins", () => {
  const tools = APP_TOOLS.map((tool) => ({ id: tool.id, href: tool.href }))
  assert.equal(toolIdForPagePath("/daily-tasks", tools), "daily-tasks")
  assert.equal(toolIdForPagePath("/trending-topics/history", tools), "trending-topics")
  assert.equal(toolIdForPagePath("/login", tools), null)
})

test("a tool is refused only for the account it was turned off for", () => {
  assert.equal(isFeatureDisabled(user(["daily-tasks"]), "daily-tasks"), true)
  assert.equal(isFeatureDisabled(user(["daily-tasks"]), "quick-notes"), false)
  assert.equal(isFeatureDisabled(user([]), "daily-tasks"), false)
})

test("an admin always keeps every tool, whatever is stored against the account", () => {
  assert.equal(isFeatureDisabled(admin(["daily-tasks"]), "daily-tasks"), false)
})

test("a request that belongs to no tool, or no account, is never refused", () => {
  assert.equal(isFeatureDisabled(user(["daily-tasks"]), null), false)
  assert.equal(isFeatureDisabled(null, "daily-tasks"), false)
})

test("the sidebar drops a tool that is turned off, and keeps the rest", () => {
  const all = toolsFor(false)
  const some = toolsFor(false, ["daily-tasks", "quick-notes"])
  assert.equal(some.length, all.length - 2)
  assert.equal(
    some.some((tool) => tool.id === "daily-tasks"),
    false
  )
})

test("an admin's sidebar is never shortened by what is stored against them", () => {
  assert.equal(toolsFor(true, ["daily-tasks"]).length, toolsFor(true).length)
})

test("the admin area can never be turned off, so nobody can be locked out of it", () => {
  const manageable = manageableFeatures().map((tool) => tool.id)
  const adminTool = APP_TOOLS.find((tool) => tool.adminOnly)
  assert.ok(adminTool, "there should be an admin-only tool")
  assert.equal(manageable.includes(adminTool.id), false)
})
