import { createHash } from "node:crypto"
import mongoose, { isValidObjectId } from "mongoose"
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb"
import type { Collection } from "mongodb"
import { connectDatabase } from "@/lib/db"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { entryText, piecesOf, type EntryFields } from "@/lib/profileSections"
import { PROFILE_SEARCH_MIN_SCORE, PROFILE_SEARCH_RESULTS, sectionById } from "@/constants/profileSections"
import { GeminiEmbeddings, geminiEmbeddingSettings, isGeminiEmbeddingConfigured, missingGeminiConfiguration } from "@/services/embeddings/gemini"
import { ProfileEntryModel } from "@/models/ProfileEntry"
import { ProfileVectorModel, type IProfileVector } from "@/models/ProfileVector"
import { UserModel } from "@/models/User"
import type { ProfileSearchMatch, ProfileSearchState } from "@/types/myProfile"

/**
 * Each person's My AI Profile as a vector database, in MongoDB.
 *
 * Every entry (a role, a project, a skill …) and the Profile Info text are written out as text
 * (lib/profileSections.ts `entryText`), cut into pieces only when long, and turned into vectors by
 * Gemini (services/embeddings/gemini.ts) in `profile_vectors`, which carries a vector search index.
 * A question is turned into a vector the same way and only the closest pieces of **that person's**
 * profile come back: every search is filtered on their own account id inside the database.
 *
 * Tokens are spent only on what changed: each source carries the fingerprint of its text, the model
 * and the length, and a source whose fingerprint is unchanged is never embedded again. An edit writes
 * that one entry again, and only when its text really changed; reordering costs nothing.
 *
 * Saving never waits on this to succeed: an entry is saved first, then embedded, and one Gemini could
 * not take is marked as failed with the reason and tried again on the next visit (`catchUpSearch`).
 */

const VECTOR_INDEX = "profile_vectors_index"
const PROFILE_INFO_SOURCE = "profile-info"
// Profile Info is one long text, so it is cut smaller than an entry: a question then finds the paragraph it is about
const PROFILE_INFO_PIECE_CHARS = 1500
const INDEX_READY_TIMEOUT_MS = 60_000
// How many sources are read in for a catch-up at once; the embedding itself goes in batches of 100
const CATCH_UP_BATCH = 200

type StoreCollection = ConstructorParameters<typeof MongoDBAtlasVectorSearch>[1]["collection"]

function collectionOf(): Collection & StoreCollection {
  const db = mongoose.connection.db
  if (!db) throw new UserFacingError("The database is unavailable. Try again in a moment.")
  return db.collection(ProfileVectorModel.collection.collectionName) as unknown as Collection & StoreCollection
}

/**
 * The vector search index, made once (and remade if the vector length changes): cosine similarity,
 * with the person and the section as filter fields, so one person's pieces are searched without
 * reading anyone else's.
 */
async function ensureVectorIndex(dimensions: number): Promise<void> {
  const collection = collectionOf()
  const definition = {
    fields: [
      { type: "vector", path: "embedding", numDimensions: dimensions, similarity: "cosine" },
      { type: "filter", path: "ownerId" },
      { type: "filter", path: "section" },
    ],
  }
  const existing = (await collection.listSearchIndexes().toArray()).find((index) => index.name === VECTOR_INDEX) as
    | { latestDefinition?: { fields?: { type?: string; numDimensions?: number }[] }; queryable?: boolean }
    | undefined
  if (!existing) {
    await collection.createSearchIndex({ name: VECTOR_INDEX, type: "vectorSearch", definition })
    console.info("🧭 Vector index created for My AI Profile")
  } else if (existing.latestDefinition?.fields?.find((field) => field.type === "vector")?.numDimensions !== dimensions) {
    await collection.updateSearchIndex(VECTOR_INDEX, definition)
    console.info("🧭 My AI Profile vector index changed to", dimensions, "dimensions")
  } else if (existing.queryable) {
    return
  }
  const until = Date.now() + INDEX_READY_TIMEOUT_MS
  while (Date.now() < until) {
    const index = (await collection.listSearchIndexes().toArray()).find((entry) => entry.name === VECTOR_INDEX) as { queryable?: boolean } | undefined
    if (index?.queryable) return
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  throw new UserFacingError("Your profile's search index is still being built. Try again in a moment.")
}

const hashOf = (text: string, model: string, dimensions: number) => createHash("sha256").update(`${model}\u0000${dimensions}\u0000${text}`).digest("hex")

/** The text an entry is embedded as, or "" for a section the app no longer has. */
function textOfEntry(section: string, fields: unknown): string {
  const known = sectionById(section)
  return known ? entryText(known, (fields ?? {}) as EntryFields) : ""
}

interface Source {
  sourceId: string
  section: string
  text: string
  hash: string
}

/**
 * Writes every source's pieces in as few Gemini calls as possible (100 texts a call), then, source
 * by source, removes its older pieces, but only once it is sure the text it wrote is still the text
 * the source holds: an entry edited or deleted while Gemini was answering keeps its newer pieces, and
 * these are taken back out instead. Answers which sources are now searchable.
 */
async function writeSources(ownerId: string, sources: Source[], stillCurrent: (source: Source) => Promise<boolean>, signal?: AbortSignal): Promise<Set<string>> {
  const { model, dimensions } = geminiEmbeddingSettings()
  const pieces = sources.flatMap((source) =>
    piecesOf(source.text, source.sourceId === PROFILE_INFO_SOURCE ? PROFILE_INFO_PIECE_CHARS : undefined).map((text, piece) => ({ source, piece, text }))
  )
  if (pieces.length === 0) return new Set()
  const vectors = await new GeminiEmbeddings("RETRIEVAL_DOCUMENT", signal).embedDocuments(pieces.map((entry) => entry.text))
  await ensureVectorIndex(dimensions)
  const documents: Omit<IProfileVector, "createdAt" | "updatedAt">[] = pieces.map((entry, index) => ({
    ownerId,
    sourceId: entry.source.sourceId,
    section: entry.source.section,
    piece: entry.piece,
    text: entry.text,
    embedding: vectors[index],
    model,
    dimensions,
    contentHash: entry.source.hash,
  }))
  await ProfileVectorModel.insertMany(documents)

  const written = new Set<string>()
  for (const source of sources) {
    if (await stillCurrent(source)) {
      await ProfileVectorModel.deleteMany({ ownerId, sourceId: source.sourceId, contentHash: { $ne: source.hash } })
      written.add(source.sourceId)
    } else {
      await ProfileVectorModel.deleteMany({ ownerId, sourceId: source.sourceId, contentHash: source.hash })
    }
  }
  console.info("🧭 My AI Profile vectors written", { sources: sources.length, pieces: pieces.length, model })
  return written
}

/** One entry as it is saved, for the embedding that follows. */
export interface IndexedEntry {
  id: string
  section: string
  fields: unknown
}

/**
 * Saves these entries for search. An entry whose text is already searchable costs nothing; the rest
 * are embedded together and marked ready, or failed with the reason, which the page shows. Never
 * throws: the entries are saved whatever happens here.
 */
export async function indexEntries(ownerId: string, entries: readonly IndexedEntry[], signal?: AbortSignal): Promise<void> {
  if (entries.length === 0 || !isGeminiEmbeddingConfigured()) return
  await connectDatabase()
  const { model, dimensions } = geminiEmbeddingSettings()
  const ids = entries.map((entry) => entry.id).filter((id) => isValidObjectId(id))
  const saved = await ProfileEntryModel.find({ _id: { $in: ids }, ownerId }, { searchHash: 1, searchStatus: 1 }).lean()
  const known = new Map(saved.map((entry) => [String(entry._id), entry]))
  const sources: Source[] = entries.flatMap((entry) => {
    const text = textOfEntry(entry.section, entry.fields)
    const hash = hashOf(text, model, dimensions)
    const current = known.get(entry.id)
    if (!current || !text || (current.searchStatus === "ready" && current.searchHash === hash)) return []
    return [{ sourceId: entry.id, section: entry.section, text, hash }]
  })
  if (sources.length === 0) return

  try {
    const written = await writeSources(
      ownerId,
      sources,
      async (source) => {
        const entry = await ProfileEntryModel.findOne({ _id: source.sourceId, ownerId }, { section: 1, fields: 1 }).lean()
        return Boolean(entry) && hashOf(textOfEntry(entry?.section ?? "", entry?.fields), model, dimensions) === source.hash
      },
      signal
    )
    await ProfileEntryModel.bulkWrite(
      sources
        .filter((source) => written.has(source.sourceId))
        .map((source) => ({
          updateOne: {
            filter: { _id: source.sourceId, ownerId },
            update: { $set: { searchStatus: "ready", searchHash: source.hash, searchError: null, searchedAt: new Date() } },
            timestamps: false,
          },
        }))
    )
  } catch (error: unknown) {
    const reason = toUserFacingMessage(error, "Gemini could not save this for search.")
    console.warn("⚠️ My AI Profile entries were not saved for search:", reason)
    await ProfileEntryModel.updateMany(
      { _id: { $in: sources.map((source) => source.sourceId) }, ownerId },
      { $set: { searchStatus: "failed", searchError: reason } },
      { timestamps: false }
    )
  }
}

/** Saves the person's Profile Info for search, or clears it when the text is empty. Never throws. */
export async function indexProfileInfo(ownerId: string, text: string, signal?: AbortSignal): Promise<void> {
  if (!isGeminiEmbeddingConfigured() || !isValidObjectId(ownerId)) return
  await connectDatabase()
  const trimmed = text.trim()
  if (!trimmed) {
    await ProfileVectorModel.deleteMany({ ownerId, sourceId: PROFILE_INFO_SOURCE })
    await UserModel.updateOne({ _id: ownerId }, { $set: { profileInfoSearchError: null } }, { timestamps: false })
    return
  }
  const { model, dimensions } = geminiEmbeddingSettings()
  const body = `Profile Info\n${trimmed}`
  const hash = hashOf(body, model, dimensions)
  const [have, total] = await Promise.all([
    ProfileVectorModel.countDocuments({ ownerId, sourceId: PROFILE_INFO_SOURCE, contentHash: hash }),
    ProfileVectorModel.countDocuments({ ownerId, sourceId: PROFILE_INFO_SOURCE }),
  ])
  if (have > 0 && have === total) return
  try {
    await writeSources(
      ownerId,
      [{ sourceId: PROFILE_INFO_SOURCE, section: PROFILE_INFO_SOURCE, text: body, hash }],
      async () => {
        const account = await UserModel.findById(ownerId, { profileInfo: 1 }).lean()
        return hashOf(`Profile Info\n${(account?.profileInfo ?? "").trim()}`, model, dimensions) === hash
      },
      signal
    )
    await UserModel.updateOne({ _id: ownerId }, { $set: { profileInfoSearchError: null } }, { timestamps: false })
  } catch (error: unknown) {
    const reason = toUserFacingMessage(error, "Gemini could not save your Profile Info for search.")
    console.warn("⚠️ Profile Info was not saved for search:", reason)
    await UserModel.updateOne({ _id: ownerId }, { $set: { profileInfoSearchError: reason } }, { timestamps: false })
  }
}

/**
 * Everything of this person's that is not yet searchable as it stands now: entries waiting or failed,
 * entries written with another model or length, and Profile Info. Called when My AI Profile opens
 * and from its Try again, so a failure heals itself the next time it can.
 */
export async function catchUpSearch(ownerId: string, signal?: AbortSignal): Promise<void> {
  if (!isGeminiEmbeddingConfigured()) return
  await connectDatabase()
  const { model, dimensions } = geminiEmbeddingSettings()
  const entries = await ProfileEntryModel.find({ ownerId }, { section: 1, fields: 1, searchStatus: 1, searchHash: 1 }).lean()
  const stale = entries
    .filter((entry) => entry.searchStatus !== "ready" || entry.searchHash !== hashOf(textOfEntry(entry.section, entry.fields), model, dimensions))
    .map((entry) => ({ id: String(entry._id), section: entry.section, fields: entry.fields }))
  // An entry marked ready under an old fingerprint is written again too: a changed model counts as a change
  for (let at = 0; at < stale.length; at += CATCH_UP_BATCH) await indexEntries(ownerId, stale.slice(at, at + CATCH_UP_BATCH), signal)
  const account = await UserModel.findById(ownerId, { profileInfo: 1 }).lean()
  await indexProfileInfo(ownerId, account?.profileInfo ?? "", signal)
}

/** An entry's vectors, when the entry is deleted. */
export async function deleteEntryVectors(ownerId: string, entryIds: readonly string[]): Promise<void> {
  if (entryIds.length === 0) return
  await connectDatabase()
  await ProfileVectorModel.deleteMany({ ownerId, sourceId: { $in: [...entryIds] } })
}

/** How this person's profile stands in search, for the line at the top of My AI Profile. */
export async function profileSearchState(ownerId: string): Promise<ProfileSearchState> {
  const missing = missingGeminiConfiguration()
  if (missing.length > 0) return { configured: false, missing, total: 0, ready: 0, pending: 0, failed: 0, errors: [] }
  await connectDatabase()
  const { model, dimensions } = geminiEmbeddingSettings()
  const [entries, account, infoPieces] = await Promise.all([
    ProfileEntryModel.find({ ownerId }, { section: 1, fields: 1, searchStatus: 1, searchHash: 1, searchError: 1 }).lean(),
    UserModel.findById(ownerId, { profileInfo: 1, profileInfoSearchError: 1 }).lean(),
    ProfileVectorModel.distinct("contentHash", { ownerId, sourceId: PROFILE_INFO_SOURCE }),
  ])
  let ready = 0
  let pending = 0
  let failed = 0
  const errors = new Set<string>()
  for (const entry of entries) {
    const isCurrent = entry.searchStatus === "ready" && entry.searchHash === hashOf(textOfEntry(entry.section, entry.fields), model, dimensions)
    if (isCurrent) ready += 1
    else if (entry.searchStatus === "failed") {
      failed += 1
      if (entry.searchError) errors.add(entry.searchError)
    } else pending += 1
  }
  const info = (account?.profileInfo ?? "").trim()
  if (info) {
    const isCurrent = infoPieces.length === 1 && infoPieces[0] === hashOf(`Profile Info\n${info}`, model, dimensions)
    if (isCurrent) ready += 1
    else if (account?.profileInfoSearchError) {
      failed += 1
      errors.add(account.profileInfoSearchError)
    } else pending += 1
  }
  return { configured: true, missing: [], total: ready + pending + failed, ready, pending, failed, errors: [...errors].slice(0, 3) }
}

/**
 * The pieces of this person's profile closest in meaning to a question, through LangChain's MongoDB
 * vector store, filtered to them inside the database. Anything too far from the question is dropped.
 * A caller that reads the profile to shape an answer (the Finance Bot) asks for more pieces, and lets
 * through ones a little further away, than the search box on My AI Profile does.
 */
export async function searchMyProfile(
  ownerId: string,
  question: string,
  signal?: AbortSignal,
  { limit = PROFILE_SEARCH_RESULTS, minScore = PROFILE_SEARCH_MIN_SCORE }: { limit?: number; minScore?: number } = {}
): Promise<ProfileSearchMatch[]> {
  await connectDatabase()
  const store = new MongoDBAtlasVectorSearch(new GeminiEmbeddings("RETRIEVAL_QUERY", signal), {
    collection: collectionOf(),
    indexName: VECTOR_INDEX,
    textKey: "text",
    embeddingKey: "embedding",
  })
  const found = await store.similaritySearchWithScore(question, limit, {
    preFilter: { ownerId: { $eq: ownerId } },
    numCandidates: limit * 20,
  })
  return found
    .filter(([, score]) => score >= minScore)
    .map(([document, score]) => ({
      sourceId: String(document.metadata.sourceId ?? ""),
      section: String(document.metadata.section ?? ""),
      text: document.pageContent,
      score,
    }))
}
