import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const GEMINI = /gemini|google-genai|googleSearch|GOOGLE_API_KEY|generativelanguage|groundingMetadata/i
// Gemini as a place the user pastes a prompt (Prompt Creator's "ChatGPT / Gemini Search" target), not an integration
const ALLOWED = [/ChatGPT \/ Gemini Search/, /ChatGPT and Gemini web search/]
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".vercel", "backups"])

function* files(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* files(full)
    else if (/\.(ts|tsx|js|mjs|json)$/.test(entry.name)) yield full
  }
}

test("no Gemini code, package, credential or environment variable is left", () => {
  const targets = [
    ...files(path.join(root, "src")),
    ...files(path.join(root, "scripts")),
    path.join(root, "package.json"),
    path.join(root, ".env.example"),
    path.join(root, "next.config.ts"),
  ]
  const found = []
  for (const file of targets) {
    if (!fs.existsSync(file)) continue
    fs.readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (GEMINI.test(line) && !ALLOWED.some((allowed) => allowed.test(line))) found.push(`${path.relative(root, file)}:${index + 1}: ${line.trim().slice(0, 120)}`)
      })
  }
  assert.deepEqual(found, [])
})

test("the Gemini SDK is not installed as a dependency", () => {
  const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"))
  assert.equal(
    Object.keys(lock.packages ?? {}).some((name) => name.endsWith("@langchain/google-genai")),
    false
  )
})
