#!/usr/bin/env node
/**
 * Adds the sample data the outreach tools were missing.
 *
 * Dummy Data for Testing (`/admin/dummy-data`) had three profiles, and all three were written for
 * Connection Note's tones (a funded founder, a hiring CTO). First Message and InMail share that
 * same `profiles` kind, so their buttons worked but there was nothing written for **their** tones:
 * someone who viewed your profile and accepted, a trigger event worth opening on, someone who
 * interacted with a post, a plain decision maker for the ABCD method. Message Rewriter's kind
 * (`messages-to-rewrite`) had no items at all.
 *
 *   node scripts/add-outreach-dummy-data.mjs [--dry-run]
 *   node scripts/add-outreach-dummy-data.mjs --down [--force]
 *
 * It only ever **inserts a missing item**, so running it twice changes nothing and an item edited
 * in the app is never overwritten. `--down` removes exactly the items it added, and refuses one
 * whose text has been changed since unless `--force` is given.
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import mongoose from "mongoose"

const dryRun = process.argv.includes("--dry-run")
const down = process.argv.includes("--down")
const force = process.argv.includes("--force")

function databaseUri() {
  for (const name of [".env.local", ".env"]) {
    const path = join(process.cwd(), name)
    if (!existsSync(path)) continue
    const line = readFileSync(path, "utf8")
      .split("\n")
      .find((row) => row.startsWith("MONGODB_URI="))
    if (line) return line.slice("MONGODB_URI=".length).trim().replace(/^"|"$/g, "")
  }
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI
  throw new Error("MONGODB_URI is not set: put it in .env.local or the environment.")
}

// The id the app gives an item, from its name (services/dummyData.ts)
const slugify = (name) =>
  name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 50)
    .replace(/^-+|-+$/g, "") || "item"

const ITEMS = [
  {
    kind: "profiles",
    name: "Viewed your profile and accepted (fictional)",
    fields: {
      profile: `Omar Farooq
Head of Product at Trackly | Delivery software for distributors
Karachi, Sindh, Pakistan · Contact info
2,400 followers · 500+ connections

About
I look after the product at Trackly, where we build the software distributors use to plan deliveries, track vans and keep their customers told. I came to product from eight years of running operations for an FMCG distributor, so most of what we build started as something that annoyed me on a Tuesday morning.

What I care about: fewer screens, fewer clicks, and a driver app that works on a cheap phone with one bar of signal.

Experience
Head of Product · Trackly
Jan 2024 - Present · 1 yr 10 mos
Took the product from one city to four. Rebuilt the route planner so a 60 stop day is planned in under a minute, and shipped a driver app that works offline.

Product Manager · Trackly
2022 - 2023 · 1 yr

Operations Manager · Shaheen Distributors
2016 - 2022 · 6 yrs
Ran 30 vans and 90 routes across Karachi.

Education
Institute of Business Administration, Karachi - BBA

Activity
Omar Farooq commented on a post · 1w
"The hard part was never the map. It is what happens when the driver has no signal."

Omar Farooq posted this · 3w
We spent a month making the driver app smaller instead of adding to it. Crashes are down 80% on the cheap phones our drivers actually carry. Not glamorous. Worth it.`,
    },
  },
  {
    kind: "profiles",
    name: "Trigger event, just started as Head of Growth (fictional)",
    fields: {
      profile: `Ayesha Rehman
Head of Growth at Fyndr | Marketplace for home services
Dubai, United Arab Emirates · Contact info
6,100 followers · 500+ connections

About
Two weeks into a new job, so ask me again in a month. Before Fyndr I spent four years at Careem working on rider growth, and two before that at a small agency where I learned how little budget you really need to find out whether something works.

I am most useful where there is a product people already like and nobody can tell you why they found it.

Experience
Head of Growth · Fyndr
Oct 2026 - Present · 2 wks
Dubai, UAE

Growth Lead · Careem
2022 - 2026 · 4 yrs
Ran acquisition for riders in three markets. Took paid cost per rider down 38% in a year by replacing broad campaigns with a referral loop that actually paid out.

Performance Marketing · Hashtag Media
2020 - 2022 · 2 yrs

Education
Lahore University of Management Sciences - BSc Economics

Activity
Ayesha Rehman shared a post · 4d
New chapter. I have joined Fyndr as Head of Growth. We are hiring across performance, lifecycle and content, and I am spending my first month talking to customers rather than touching the ad account.

Ayesha Rehman commented on a post · 2w
"Attribution is a story you tell yourself. Incrementality is the only honest number."`,
    },
  },
  {
    kind: "profiles",
    name: "Interacted with your post, agency owner (fictional)",
    fields: {
      profile: `Daniyal Siddiqui
Founder at Northline Studio | Brand and web design for B2B software
Islamabad, Pakistan · Contact info
14,000 followers · 500+ connections

About
I run a six person studio that designs and builds websites for B2B software companies. We have shipped 40+ sites since 2021, mostly for teams between seed and Series A who have outgrown a template and do not want an agency that disappears after launch.

I post most days about design, positioning and what actually moves a demo request.

Experience
Founder & Creative Director · Northline Studio
2021 - Present · 5 yrs
Islamabad · Remote

Senior Designer · Folio Agency
2017 - 2021 · 4 yrs

Education
National College of Arts - BFA Communication Design

Activity
Daniyal Siddiqui likes your post · 2d

Daniyal Siddiqui commented on your post · 2d
"The part about the hero section carrying the whole pitch is right. Most of the sites we rebuild are three good sentences buried under a slider."

Daniyal Siddiqui posted this · 5d
A website is not a brochure, it is the first conversation. If it cannot answer "what is this and who is it for" in five seconds, nothing else on the page matters.`,
    },
  },
  {
    kind: "profiles",
    name: "Decision maker, operations lead at a mid-size firm (fictional)",
    fields: {
      profile: `Hina Qureshi
Chief Operating Officer at Meridian Logistics
Dubai, United Arab Emirates · Contact info
3,800 followers · 500+ connections

About
I run operations for a freight forwarder moving about 9,000 shipments a year between the Gulf, Pakistan and East Africa. My job is mostly removing the reasons a shipment stops moving: a missing document, a customs query nobody answered, a truck nobody booked.

We are a 140 person company that still runs more of its day on email and spreadsheets than I would like.

Experience
Chief Operating Officer · Meridian Logistics
2023 - Present · 3 yrs
Dubai, UAE

Head of Operations · Meridian Logistics
2019 - 2023 · 4 yrs
Cut the time from booking to documents issued from four days to one, mostly by deciding who owns what rather than by buying software.

Operations Manager · Gulf Freight Services
2014 - 2019 · 5 yrs

Education
University of Karachi - MBA

Activity
Hina Qureshi posted this · 1w
Every tool we have bought in three years solved a problem we could describe in one sentence. The ones we stopped paying for solved problems a vendor described for us.`,
    },
  },
  {
    kind: "messages-to-rewrite",
    name: "Mixed Urdu and English update to a client (fictional)",
    fields: {
      message: `salam sir, aj ka update ye hai ke login page ka kaam ho gaya hai, abhi sirf ek chota sa issue tha jo email verification ka tha wo bhi solve kr dia hai. kal se me dashboard pe kaam start kr rha hun, aapko kal shaam tak demo bhej dunga. agar aapko koi change chahiye design me to bata dein, abhi karna easy hai baad me mushkil ho jata hai.`,
    },
  },
  {
    kind: "messages-to-rewrite",
    name: "Long rambling status that needs cutting down (fictional)",
    fields: {
      message: `Hi, so I wanted to let you know about where we are, basically the API work took a bit longer than I thought because the payment provider changed their sandbox and we had to redo the webhook part, which is done now and tested, and also I looked at the reports page and I think the way it is loading all the data at once is going to be slow when you have a year of data so I want to change it to load page by page which will take maybe a day, and other than that everything else is on track, the login, the onboarding and the emails are all done, and I will start the reports change tomorrow unless you want me to do something else first, let me know what you think.`,
    },
  },
  {
    kind: "messages-to-rewrite",
    name: "Short note that needs to become a sentence (fictional)",
    fields: {
      message: `mtg 3pm cancel, resched thu or fri, pls confirm`,
    },
  },
]

const run = async () => {
  await mongoose.connect(databaseUri(), { dbName: "LinkPilot" })
  const items = mongoose.connection.db.collection("dummy_data")

  if (down) {
    let removed = 0
    for (const item of ITEMS) {
      const slug = slugify(item.name)
      const stored = await items.findOne({ kind: item.kind, slug })
      if (!stored) {
        console.log(`- ${item.kind}/${slug}: not there`)
        continue
      }
      const sameText = Object.entries(item.fields).every(([key, value]) => (stored.fields?.[key] ?? "") === value)
      if (!sameText && !force) {
        console.log(`! ${item.kind}/${slug}: changed in the app, left alone (use --force to remove it anyway)`)
        continue
      }
      if (!dryRun) await items.deleteOne({ _id: stored._id })
      removed += 1
      console.log(`${dryRun ? "would remove" : "removed"} ${item.kind}/${slug}`)
    }
    console.log(`\n${dryRun ? "Would remove" : "Removed"} ${removed} item(s).`)
    await mongoose.disconnect()
    return
  }

  let added = 0
  for (const item of ITEMS) {
    const slug = slugify(item.name)
    const stored = await items.findOne({ kind: item.kind, slug })
    if (stored) {
      console.log(`= ${item.kind}/${slug}: already there, left exactly as it is`)
      continue
    }
    if (!dryRun) {
      const now = new Date()
      await items.insertOne({ kind: item.kind, slug, name: item.name, fields: item.fields, createdAt: now, updatedAt: now })
    }
    added += 1
    console.log(`${dryRun ? "would add" : "added"} ${item.kind}/${slug} — ${item.name}`)
  }
  console.log(`\n${dryRun ? "Would add" : "Added"} ${added} item(s) of ${ITEMS.length}.`)
  await mongoose.disconnect()
}

run().catch(async (error) => {
  console.error("Failed:", error instanceof Error ? error.message : error)
  try {
    await mongoose.disconnect()
  } catch {}
  process.exit(1)
})
