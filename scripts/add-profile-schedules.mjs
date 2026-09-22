// Adds LinkedIn profiles to Comment Writer's Profile Scheduler (/comment-writer/profiles) for one
// account, on the days given, straight into the `profile_schedules` collection.
//
//   node scripts/add-profile-schedules.mjs --file scripts/profile-lists/monday.txt --days monday
//   node scripts/add-profile-schedules.mjs --days monday,thursday linkedin.com/in/someone linkedin.com/in/other
//   node scripts/add-profile-schedules.mjs --email someone@example.com --file <list> --days friday
//   node scripts/add-profile-schedules.mjs --file <list> --days monday --dry-run    shows what it would do
//
// --email defaults to rafay@linkpilot.ai. A list file holds one link per line; blank lines and
// anything after a # are ignored, so a note on who the profile is can sit beside its link.
//
// Links are kept in the app's one form (src/lib/linkedinProfile.ts): https://www.linkedin.com/in/<name>,
// lowercased, anything after the name dropped. A profile the account already has keeps its days and
// gains the new ones, so running it twice, or with another day, never makes a duplicate. Nothing is
// ever deleted.

import { existsSync, readFileSync } from "node:fs"
import { MongoClient } from "mongodb"

// src/constants/profileScheduler.ts WEEK_DAYS, in week order
const WEEK_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
const DEFAULT_EMAIL = "rafay@linkpilot.ai"

const fail = (message) => {
  console.error(`\n${message}\n`)
  process.exit(1)
}

// The same rule as normalizeProfileUrl in src/lib/linkedinProfile.ts
const HANDLE = /^[\p{L}\p{N}\-_]{2,100}$/u
const LINKEDIN_HOST = /^([a-z0-9-]+\.)?linkedin\.com$/
const decoded = (handle) => {
  try {
    return decodeURIComponent(handle)
  } catch {
    return null
  }
}
function normalizeProfileUrl(input) {
  const text = input.trim()
  if (!text || /\s/.test(text)) return null
  let url
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  if (!LINKEDIN_HOST.test(url.hostname.toLowerCase())) return null
  const [section, handle] = url.pathname.split("/").filter(Boolean)
  if (section?.toLowerCase() !== "in" || !handle || !HANDLE.test(decoded(handle) ?? "")) return null
  return `https://www.linkedin.com/in/${handle.toLowerCase()}`
}

function readArgs(argv) {
  const args = { email: DEFAULT_EMAIL, days: null, file: null, dryRun: false, links: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--email") args.email = argv[++i]
    else if (arg === "--days") args.days = argv[++i]
    else if (arg === "--file") args.file = argv[++i]
    else if (arg === "--dry-run") args.dryRun = true
    else if (arg.startsWith("--")) fail(`Unknown option ${arg}.`)
    else args.links.push(arg)
  }
  if (!args.email) fail("--email needs an address.")
  if (!args.days) fail("Say which days, for example --days monday or --days monday,thursday.")
  const days = [...new Set(args.days.split(",").map((day) => day.trim().toLowerCase()).filter(Boolean))]
  const unknown = days.filter((day) => !WEEK_DAYS.includes(day))
  if (unknown.length || !days.length) fail(`Unknown day: ${unknown.join(", ") || args.days}. Use ${WEEK_DAYS.join(", ")}.`)
  args.days = days
  if (args.file) {
    if (!existsSync(args.file)) fail(`No such file: ${args.file}`)
    const lines = readFileSync(args.file, "utf8").split(/\r?\n/)
    args.links.push(...lines.map((line) => line.split("#")[0].trim()).filter(Boolean))
  }
  if (!args.links.length) fail("No links given. Pass --file <list> or the links themselves.")
  return args
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

const inWeekOrder = (days) => WEEK_DAYS.filter((day) => days.includes(day))

async function main() {
  const args = readArgs(process.argv.slice(2))

  const profiles = []
  const refused = []
  for (const link of args.links) {
    const url = normalizeProfileUrl(link)
    if (!url) refused.push(link)
    else if (!profiles.includes(url)) profiles.push(url)
  }
  if (refused.length) fail(`Not LinkedIn profile links, nothing was saved:\n  ${refused.join("\n  ")}`)

  const client = await MongoClient.connect(mongoUri(), { serverSelectionTimeoutMS: 20000 })
  try {
    const db = client.db()
    const user = await db.collection("users").findOne({ email: args.email.trim().toLowerCase() }, { projection: { _id: 1, name: 1 } })
    if (!user) fail(`No account with the email ${args.email}.`)
    const ownerId = String(user._id)
    const schedules = db.collection("profile_schedules")

    let added = 0
    let extended = 0
    let unchanged = 0
    for (const profileUrl of profiles) {
      const existing = await schedules.findOne({ ownerId, profileUrl })
      if (!existing) {
        added++
        console.log(`  + ${profileUrl}  (${args.days.join(", ")})`)
        if (!args.dryRun) {
          const now = new Date()
          await schedules.insertOne({ ownerId, profileUrl, days: inWeekOrder(args.days), createdAt: now, updatedAt: now, __v: 0 })
        }
        continue
      }
      const days = inWeekOrder([...existing.days, ...args.days])
      if (days.length === existing.days.length) {
        unchanged++
        console.log(`  = ${profileUrl}  already on ${existing.days.join(", ")}`)
        continue
      }
      extended++
      console.log(`  ~ ${profileUrl}  ${existing.days.join(", ")} -> ${days.join(", ")}`)
      if (!args.dryRun) await schedules.updateOne({ _id: existing._id }, { $set: { days, updatedAt: new Date() } })
    }

    console.log(
      `\n${args.dryRun ? "Dry run, nothing saved. Would have: " : ""}${added} added, ${extended} given the new day, ${unchanged} already there, for ${user.name} (${args.email}).`
    )
  } finally {
    await client.close()
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
