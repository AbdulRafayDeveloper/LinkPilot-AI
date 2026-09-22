// Imports the outreach sheet into Comment Writer's Profile Scheduler (/comment-writer/profiles) for one
// account: each person's name, role, company, location, sector, why now (what happened, when and where
// it was read), notes, LinkedIn link and types (Funded Founder, Investor, Creator, Agency, several
// allowed), on the days given. It replaces scripts/add-profile-schedules.mjs, which read a list of links
// only and so saved nobody's details.
//
//   node scripts/import-profile-people.mjs --file scripts/profile-lists/outreach.csv --days monday
//   node scripts/import-profile-people.mjs --file <sheet.csv> --days monday,thursday --email someone@example.com
//   node scripts/import-profile-people.mjs --file <sheet.csv> --days monday --dry-run      shows what it would do
//
// The sheet is the outreach sheet saved as CSV (File, Save as, CSV). Its first row names the columns;
// Type, Name, Role, Company, Location, Sector, Signal / Why now, Funding or data date, LinkedIn, Source
// and Notes are read, whatever their order, and the columns the list doesn't keep (the row number, and
// the Commented and Reply columns, which are the user's own tracking) are left alone. A Type cell may
// hold several types ("Agency, Creator"), and the sheet's older headings (Signal, Reach, Referral) still
// read. A LinkedIn cell that isn't a profile link ("Search: ... (URL not verified)") keeps the person,
// without a link, to be added on the page later.
//
// Nothing is ever deleted and nothing is saved twice. A person already on the list is found by their
// link, or, while they have none, by their name; they keep what they have, gain the sheet's details
// where the sheet has them, and gain its types and days. Reading the sheet and checking each person
// use the app's own code (src/lib/profilePeople.ts, src/lib/validation/profileSchedules.ts), so the
// script can never save what the page would refuse. Run scripts/migrate-profile-people.mjs up first.
//
// --email defaults to rafay@linkpilot.ai. Keep the sheets in scripts/profile-lists/, which git ignores:
// they are lists of real people and the repository is public.

import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import createJiti from "jiti"
import { MongoClient } from "mongodb"

const DEFAULT_EMAIL = "rafay@linkpilot.ai"
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const jiti = createJiti(fileURLToPath(import.meta.url), { alias: { "@": path.join(root, "src") }, interopDefault: true })
const { peopleFromSheet } = jiti(path.join(root, "src/lib/profilePeople.ts"))
const { ProfilePersonEditSchema } = jiti(path.join(root, "src/lib/validation/profileSchedules.ts"))
const { PERSON_TYPE_IDS, WEEK_DAY_IDS } = jiti(path.join(root, "src/constants/profileScheduler.ts"))

const fail = (message) => {
  console.error(`\n${message}\n`)
  process.exit(1)
}

function readArgs(argv) {
  const args = { email: DEFAULT_EMAIL, days: null, file: null, dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--email") args.email = argv[++i]
    else if (arg === "--days") args.days = argv[++i]
    else if (arg === "--file") args.file = argv[++i]
    else if (arg === "--dry-run") args.dryRun = true
    else fail(`Unknown option ${arg}.`)
  }
  if (!args.email) fail("--email needs an address.")
  if (!args.file) fail("Say which sheet, for example --file scripts/profile-lists/outreach.csv.")
  if (!existsSync(args.file)) fail(`No such file: ${args.file}`)
  if (!args.days) fail("Say which days, for example --days monday or --days monday,thursday.")
  return args
}

// MONGODB_URI from the environment, or from .env.local when the script is run in the project
function mongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI
  const envFile = path.join(root, ".env.local")
  if (!existsSync(envFile)) fail("MONGODB_URI is not set and there is no .env.local in the project.")
  const line = readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.startsWith("MONGODB_URI="))
  const uri = line?.slice("MONGODB_URI=".length).trim().replace(/^["']|["']$/g, "")
  if (!uri) fail("MONGODB_URI is missing from .env.local.")
  return uri
}

// Every field of a person the sheet can fill, so adding one to the list means adding it here only
const FIELDS = ["profileUrl", "name", "role", "company", "location", "sector", "whyNow", "whyNowDate", "source", "notes"]

const inOrder = (all, values) => all.filter((value) => values.includes(value))
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const describe = (person) => `${person.name || person.profileUrl}${person.types.length ? ` [${person.types.join(", ")}]` : ""}`

async function main() {
  const args = readArgs(process.argv.slice(2))
  const { people, problems } = peopleFromSheet(readFileSync(args.file, "utf8"))

  // Every person is checked the way the page's own API checks one, days included
  const checked = []
  for (const person of people) {
    const parsed = ProfilePersonEditSchema.safeParse({ ...person, days: args.days.split(",").map((day) => day.trim().toLowerCase()) })
    if (!parsed.success) problems.push(`Row ${person.line} (${person.name || person.profileUrl}): ${parsed.error.issues[0]?.message}`)
    else checked.push({ ...parsed.data, line: person.line, unlinked: person.unlinked })
  }
  if (problems.length) console.log(`Not imported:\n  ${problems.join("\n  ")}\n`)
  if (!checked.length) fail("Nobody in the sheet could be imported.")

  const client = await MongoClient.connect(mongoUri(), { serverSelectionTimeoutMS: 20000 })
  try {
    const db = client.db()
    const user = await db.collection("users").findOne({ email: args.email.trim().toLowerCase() }, { projection: { _id: 1, name: 1 } })
    if (!user) fail(`No account with the email ${args.email}.`)
    const ownerId = String(user._id)
    const schedules = db.collection("profile_schedules")

    let added = 0
    let updated = 0
    let unchanged = 0
    for (const person of checked) {
      // By link first; a person saved without one yet is found by name, and gains the link now
      const existing =
        (person.profileUrl && (await schedules.findOne({ ownerId, profileUrl: person.profileUrl }))) ||
        (person.name && (await schedules.findOne({ ownerId, name: { $regex: `^${escaped(person.name)}$`, $options: "i" }, profileUrl: { $in: [null, person.profileUrl] } }))) ||
        null
      const note = person.unlinked ? `  (no link: ${person.unlinked})` : ""
      if (!existing) {
        added++
        console.log(`  + ${describe(person)}${note}`)
        if (!args.dryRun) {
          const now = new Date()
          await schedules.insertOne({
            ownerId,
            ...Object.fromEntries(FIELDS.map((field) => [field, person[field] ?? (field === "profileUrl" ? null : "")])),
            types: person.types,
            days: person.days,
            createdAt: now,
            updatedAt: now,
            __v: 0,
          })
        }
        continue
      }
      const changes = {}
      for (const field of FIELDS) {
        if (person[field] && person[field] !== existing[field]) changes[field] = person[field]
      }
      const types = inOrder(PERSON_TYPE_IDS, [...(existing.types ?? []), ...person.types])
      if (types.length !== (existing.types ?? []).length) changes.types = types
      const days = inOrder(WEEK_DAY_IDS, [...(existing.days ?? []), ...person.days])
      if (days.length !== (existing.days ?? []).length) changes.days = days
      if (!Object.keys(changes).length) {
        unchanged++
        console.log(`  = ${describe(person)}  already there`)
        continue
      }
      updated++
      console.log(`  ~ ${describe(person)}  ${Object.keys(changes).join(", ")}${note}`)
      if (!args.dryRun) await schedules.updateOne({ _id: existing._id }, { $set: { ...changes, updatedAt: new Date() } })
    }

    const linkless = checked.filter((person) => !person.profileUrl).length
    console.log(
      `\n${args.dryRun ? "Dry run, nothing saved. Would have: " : ""}${added} added, ${updated} updated, ${unchanged} already there` +
        `${linkless ? ` (${linkless} without a LinkedIn link yet)` : ""}, for ${user.name} (${args.email}).`
    )
  } finally {
    await client.close()
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
