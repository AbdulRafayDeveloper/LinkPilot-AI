// Gives a batch to any client voice that never got one, so no kept recording is invisible.
//
// Until batches existed, a voice was only pointed at a batch (`taskGroupId`) when the task step
// finished. A run whose task step failed therefore left its recordings and transcripts saved with
// nothing naming them, so they show on no page. Every batch is written up front now, so this can
// only ever be about voices saved before that; running it on a database that has none says so and
// changes nothing.
//
// Voices are grouped the way they really arrived: same account, same client, and within
// WINDOW_MINUTES of each other, which is one run. Each group becomes a batch with no tasks and no
// questions, carrying the voices it holds, and reads on the pages like any other batch that was
// never finished.
//
//   node scripts/batch-orphan-voices.mjs --dry-run   says what it would group, writes nothing
//   node scripts/batch-orphan-voices.mjs             gives each group its batch
//   node scripts/batch-orphan-voices.mjs --down      removes only the batches this made, and frees their voices
//
// Running it twice changes nothing: a voice that has a batch is never touched. The batches it makes
// are marked `recoveredAt`, so --down can tell them from a real one and never deletes a batch a run
// really produced.

import { existsSync, readFileSync } from "node:fs"
import { MongoClient, ObjectId } from "mongodb"

// Voices further apart than this were two runs, not one
const WINDOW_MINUTES = 30

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

const isDryRun = process.argv.includes("--dry-run")
const down = process.argv.includes("--down")

const client = new MongoClient(mongoUri())
try {
  await client.connect()
  const voices = client.db().collection("client_voices")
  const batches = client.db().collection("client_voice_tasks")

  if (down) {
    const made = await batches.find({ recoveredAt: { $exists: true } }, { projection: { _id: 1 } }).toArray()
    const ids = made.map((batch) => batch._id.toString())
    if (ids.length === 0) {
      console.log("No batches were made by this script, so there is nothing to undo.")
    } else if (isDryRun) {
      console.log(`Dry run: would free the voices of ${ids.length} recovered batch(es) and remove them. Nothing written.`)
    } else {
      const freed = await voices.updateMany({ taskGroupId: { $in: ids } }, { $set: { taskGroupId: null } })
      await batches.deleteMany({ recoveredAt: { $exists: true } })
      console.log(`Removed ${ids.length} recovered batch(es) and freed ${freed.modifiedCount} voice(s).`)
    }
  } else {
    const orphans = await voices
      .find({ $or: [{ taskGroupId: null }, { taskGroupId: { $exists: false } }, { taskGroupId: "" }] })
      .sort({ ownerId: 1, clientId: 1, createdAt: 1 })
      .toArray()

    if (orphans.length === 0) {
      console.log("Every kept voice already belongs to a batch. Nothing to do.")
    } else {
      // One group per run: the same account and client, with no long gap inside it
      const groups = []
      for (const voice of orphans) {
        const last = groups[groups.length - 1]
        const sameRun =
          last &&
          String(last.ownerId) === String(voice.ownerId ?? "") &&
          String(last.clientId) === String(voice.clientId ?? "") &&
          new Date(voice.createdAt) - new Date(last.until) <= WINDOW_MINUTES * 60 * 1000
        if (sameRun) {
          last.voices.push(voice)
          last.until = voice.createdAt
        } else {
          groups.push({
            ownerId: voice.ownerId ?? null,
            clientId: voice.clientId ?? "",
            clientName: voice.clientName ?? "",
            at: voice.createdAt,
            until: voice.createdAt,
            voices: [voice],
          })
        }
      }

      console.log(`${orphans.length} voice(s) belong to no batch, which is ${groups.length} run(s).`)
      if (isDryRun) {
        for (const group of groups) {
          console.log(`  ${new Date(group.at).toISOString()}  ${group.clientName || "no client"}  ${group.voices.length} voice(s)`)
        }
        console.log("Dry run: nothing written.")
      } else {
        for (const group of groups) {
          const id = new ObjectId()
          const voiceIds = group.voices.map((voice) => voice._id.toString())
          await batches.insertOne({
            _id: id,
            ownerId: group.ownerId,
            clientId: group.clientId,
            clientName: group.clientName,
            tasks: [],
            questions: [],
            voiceCount: group.voices.length,
            voiceIds,
            missingVoices: [],
            provider: null,
            providers: [],
            editedAt: null,
            // What tells a batch this made from one a run really produced
            recoveredAt: new Date(),
            createdAt: group.at,
            updatedAt: new Date(),
          })
          await voices.updateMany({ _id: { $in: group.voices.map((voice) => voice._id) } }, { $set: { taskGroupId: id.toString() } })
        }
        const left = await voices.countDocuments({ $or: [{ taskGroupId: null }, { taskGroupId: { $exists: false } }, { taskGroupId: "" }] })
        console.log(`Gave ${groups.length} batch(es) to ${orphans.length} voice(s). ${left} voice(s) left without one.`)
      }
    }
  }
} finally {
  await client.close()
}
