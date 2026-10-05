import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { BACKUP_BATCH_SIZE } from "@/constants/backups"
import { SITE_NAME } from "@/config/site"

/**
 * The whole database written out as one JSON document, a piece at a time.
 *
 * Nothing is ever held whole: each collection is read through a cursor and each document is turned
 * into text and handed on at once, so a database far larger than the memory a serverless function
 * has still writes out. The caller decides where the pieces go (a browser download, a multipart
 * upload, or both in the same pass).
 *
 * The documents are MongoDB Extended JSON (`{"$oid":…}`, `{"$date":…}`), the shape `mongorestore`
 * and the driver both read, so an id, a date or a Decimal comes back as what it was rather than as
 * a string. `mongoose.mongo.BSON.EJSON` is the driver's own writer, so this needs no new package.
 */

const { EJSON } = mongoose.mongo.BSON

export interface DumpCounts {
  collections: number
  documents: number
}

/** The collections in the database, in a steady order so two backups read the same way. */
async function collectionNames(): Promise<string[]> {
  await connectDatabase()
  const db = mongoose.connection.db
  if (!db) throw new UserFacingError("The database is unavailable. Check MONGODB_URI and try again.")
  const found = await db.listCollections({}, { nameOnly: true }).toArray()
  return found
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith("system."))
    .sort((a, b) => a.localeCompare(b))
}

/**
 * The backup itself, as text. `counts` is filled in as it goes, so the caller can record how much
 * the file holds once the last piece has been handed over. Stopping early is the generator's own
 * `return()` (what a cancelled download calls), which closes the cursor through the `finally` below.
 */
export async function* dumpDatabase(counts: DumpCounts): AsyncGenerator<string> {
  await connectDatabase()
  const db = mongoose.connection.db
  if (!db) throw new UserFacingError("The database is unavailable. Check MONGODB_URI and try again.")
  const names = await collectionNames()

  const meta = {
    app: SITE_NAME,
    database: db.databaseName,
    takenAt: new Date().toISOString(),
    // What the documents below are written in, so whoever restores them knows how to read them
    format: "mongodb-extended-json",
    collections: names,
  }
  yield `{\n"meta": ${JSON.stringify(meta, null, 2)},\n"collections": {`

  let firstCollection = true
  for (const name of names) {
    yield `${firstCollection ? "" : ","}\n"${name}": [`
    firstCollection = false
    counts.collections += 1

    const cursor = db.collection(name).find({}, { batchSize: BACKUP_BATCH_SIZE }).batchSize(BACKUP_BATCH_SIZE)
    try {
      let firstDocument = true
      for await (const document of cursor) {
        yield `${firstDocument ? "\n" : ",\n"}${EJSON.stringify(document, { relaxed: false })}`
        firstDocument = false
        counts.documents += 1
      }
      yield firstDocument ? "]" : "\n]"
    } finally {
      await cursor.close().catch(() => undefined)
    }
  }
  yield "\n}\n}\n"
}

/** What one backup is called: the day and time it was taken, so files sort by themselves. */
export function backupFileName(takenAt: Date = new Date()): string {
  const stamp = takenAt.toISOString().replace(/\.\d+Z$/, "Z").replace(/[:]/g, "-")
  return `linkpilot-backup-${stamp}.json`
}
