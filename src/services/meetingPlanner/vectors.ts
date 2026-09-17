import { createHash } from "node:crypto"
import mongoose from "mongoose"
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb"
import type { Collection } from "mongodb"
import { connectDatabase } from "@/lib/db"
import { env } from "@/config/env"
import { isEmbeddingConfigured, OpenAIEmbeddings } from "@/services/ai"
import { MeetingVectorModel, type IMeetingVector } from "@/models/MeetingVector"
import { meetingChunks, type MeetingChunk } from "@/lib/meetingChunks"

export interface MeetingMatch {
  kind: string
  label: string
  text: string
  score: number
}
import { MATCHES_PER_QUESTION, MEETING_CHAT_MESSAGES, MIN_MATCH_SCORE, SEARCH_CANDIDATES } from "@/constants/meetingChat"
import { UserFacingError } from "@/lib/errors"
import type { MeetingPlanDetail } from "@/types/meetingPlanner"

/**
 * The meeting's own vector database, in MongoDB.
 *
 * Everything a meeting holds (the profile, the conversation so far, the notes, and every part of the
 * preparation) is cut into pieces, each piece turned into a vector by the embedding model, and kept
 * in `meeting_vectors` with a vector search index. A question is turned into a vector the same way,
 * and only the closest pieces are put in front of the model, so the whole meeting never has to be
 * sent with every question. The pieces carry a fingerprint of what the meeting held when they were
 * written, so a meeting that has since been edited or prepared again is noticed and written again.
 */

const VECTOR_INDEX = "meeting_vectors_index"
// The vector index is built once and is ready in seconds; a call waits this long before giving up on it
const INDEX_READY_TIMEOUT_MS = 60_000
// How long a write waits for the index to catch up with it before answering anyway
const INDEXING_TIMEOUT_MS = 20_000

// The vector store and the search index commands both work on the driver's own collection, not on
// Mongoose's wrapper. The store package also brings its own copy of the driver, whose types are the
// same shape under a different declaration, so the collection is handed over as the type it expects
type StoreCollection = ConstructorParameters<typeof MongoDBAtlasVectorSearch>[1]["collection"]

function collectionOf(): Collection & StoreCollection {
  const db = mongoose.connection.db
  if (!db) throw new UserFacingError("The database is unavailable. Try again in a moment.")
  return db.collection(MeetingVectorModel.collection.collectionName) as unknown as Collection & StoreCollection
}

/**
 * The vector search index, made once on this collection. Creating it is what makes the collection a
 * vector database; the meeting and the account are filter fields, so one meeting's pieces are
 * searched without reading anyone else's.
 */
async function ensureVectorIndex(dimensions: number): Promise<void> {
  const collection = collectionOf()
  const existing = await collection.listSearchIndexes().toArray()
  if (!existing.some((index) => index.name === VECTOR_INDEX)) {
    await collection.createSearchIndex({
      name: VECTOR_INDEX,
      type: "vectorSearch",
      definition: {
        fields: [
          { type: "vector", path: "embedding", numDimensions: dimensions, similarity: "cosine" },
          { type: "filter", path: "meetingId" },
          { type: "filter", path: "ownerId" },
        ],
      },
    })
    console.info("🧭 Vector index created for meeting chats")
  }
  const until = Date.now() + INDEX_READY_TIMEOUT_MS
  while (Date.now() < until) {
    const index = (await collection.listSearchIndexes().toArray()).find((entry) => entry.name === VECTOR_INDEX) as { queryable?: boolean } | undefined
    if (index?.queryable) return
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  throw new UserFacingError("The meeting's search index is still being built. Try again in a moment.")
}

/**
 * Waits until the new pieces can actually be found. A vector index catches up a moment after the
 * write, and a question asked inside that moment would find nothing and be answered as if the
 * meeting held no answer, so the search is tried with a vector already written until it comes back.
 */
async function waitForIndexed(meetingId: string, sourceHash: string, vector: number[]): Promise<void> {
  const until = Date.now() + INDEXING_TIMEOUT_MS
  while (Date.now() < until) {
    const [found] = await collectionOf()
      .aggregate([
        { $vectorSearch: { index: VECTOR_INDEX, path: "embedding", queryVector: vector, filter: { meetingId: { $eq: meetingId } }, numCandidates: 20, limit: 1 } },
        { $project: { sourceHash: 1 } },
      ])
      .toArray()
    if (found?.sourceHash === sourceHash) return
    await new Promise((resolve) => setTimeout(resolve, 750))
  }
  console.warn("⚠️ The meeting's new pieces are not searchable yet; the next question will find them")
}

const fingerprint = (chunks: MeetingChunk[], model: string) =>
  createHash("sha256").update(model).update(JSON.stringify(chunks.map((chunk) => [chunk.kind, chunk.label, chunk.text]))).digest("hex")

export interface VectorState {
  pieces: number
  // True when this call wrote the vectors again, because the meeting had changed
  rebuilt: boolean
}

/**
 * Makes sure this meeting's vectors match what the meeting holds now: nothing to do when the
 * fingerprint is unchanged, otherwise every piece is embedded and the old ones are replaced. Called
 * before a question is answered and after a preparation is saved.
 */
export async function syncMeetingVectors(meeting: MeetingPlanDetail, ownerId: string | null, signal?: AbortSignal): Promise<VectorState> {
  if (!isEmbeddingConfigured()) throw new UserFacingError(MEETING_CHAT_MESSAGES.embeddingsUnavailable)
  await connectDatabase()
  const model = env.OPENAI_EMBEDDING_MODEL as string
  const chunks = meetingChunks(meeting).filter((chunk) => chunk.text.trim().length > 0)
  if (chunks.length === 0) {
    await MeetingVectorModel.deleteMany({ meetingId: meeting.id })
    return { pieces: 0, rebuilt: false }
  }

  const sourceHash = fingerprint(chunks, model)
  const [current, saved] = await Promise.all([
    MeetingVectorModel.countDocuments({ meetingId: meeting.id, sourceHash }),
    MeetingVectorModel.countDocuments({ meetingId: meeting.id }),
  ])
  if (current === chunks.length && saved === chunks.length) return { pieces: chunks.length, rebuilt: false }

  const embeddings = new OpenAIEmbeddings(signal)
  const vectors = await embeddings.embedDocuments(chunks.map((chunk) => chunk.text))
  await ensureVectorIndex(vectors[0].length)
  const documents: Omit<IMeetingVector, "createdAt" | "updatedAt">[] = chunks.map((chunk, index) => ({
    ownerId,
    meetingId: meeting.id,
    kind: chunk.kind,
    label: chunk.label,
    text: chunk.text,
    embedding: vectors[index],
    model,
    sourceHash,
  }))
  // The old pieces go only once the new ones are written and searchable, so a question in flight
  // always has something to read and the next one never lands in the gap
  await MeetingVectorModel.insertMany(documents)
  await waitForIndexed(meeting.id, sourceHash, vectors[0])
  await MeetingVectorModel.deleteMany({ meetingId: meeting.id, sourceHash: { $ne: sourceHash } })
  console.info("🧭 Meeting vectors written", { meeting: meeting.id, pieces: chunks.length, model })
  return { pieces: chunks.length, rebuilt: true }
}

/** Removes a meeting's vectors, when the meeting itself is deleted. */
export async function deleteMeetingVectors(meetingId: string): Promise<void> {
  await connectDatabase()
  await MeetingVectorModel.deleteMany({ meetingId })
}

/**
 * The pieces of this meeting closest in meaning to the question, through LangChain's MongoDB vector
 * store: the question is embedded, `$vectorSearch` finds the nearest vectors of that meeting only,
 * and anything too far from the question is dropped rather than padded into the prompt.
 */
export async function searchMeeting(meetingId: string, question: string, signal?: AbortSignal): Promise<MeetingMatch[]> {
  await connectDatabase()
  const store = new MongoDBAtlasVectorSearch(new OpenAIEmbeddings(signal), {
    collection: collectionOf(),
    indexName: VECTOR_INDEX,
    textKey: "text",
    embeddingKey: "embedding",
  })
  const found = await store.similaritySearchWithScore(question, MATCHES_PER_QUESTION, {
    preFilter: { meetingId: { $eq: meetingId } },
    numCandidates: SEARCH_CANDIDATES,
  })
  return found
    .filter(([, score]) => score >= MIN_MATCH_SCORE)
    .map(([document, score]) => ({
      kind: String(document.metadata.kind ?? "meeting"),
      label: String(document.metadata.label ?? ""),
      text: document.pageContent,
      score,
    }))
}
