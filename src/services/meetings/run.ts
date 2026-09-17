import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { Meeting as MeetingModel } from "@/models/Meeting"
import { MeetingChunk } from "@/models/MeetingChunk"
import { splitTranscript } from "@/lib/transcriptChunks"
import { CHUNKS_PER_REQUEST, CHUNK_CONCURRENCY } from "@/constants/meetings"
import type { MeetingRunState } from "@/types/meetings"
import { analyzeChunk, ChunkResultSchema, synthesizeMeeting, type ChunkResult } from "./analysis"
import type { AiSource } from "@/types/ai"

/**
 * Running the analysis of one meeting, a bit at a time.
 *
 * Each call reads at most CHUNKS_PER_REQUEST chunks and then answers, so no request runs long
 * enough to be cut off by a serverless timeout. Every chunk result is written the moment it is
 * read, so the next call carries on where this one stopped, whatever ended it: the request
 * timing out, a provider failing, or the browser closing. The transcript itself is never touched
 * by a run, so a failed analysis can always be run again from where it got to.
 */
const runningStates = ["analyzing", "summarizing"] as const

interface RunOptions {
  signal: AbortSignal
}

// Chunk results already read for this exact transcript, oldest part first
async function storedResults(meetingId: mongoose.Types.ObjectId, transcriptHash: string) {
  const rows = await MeetingChunk.find({ meetingId, transcriptHash }, { index: 1, result: 1 }).sort({ index: 1 }).lean()
  return rows.flatMap((row) => {
    const parsed = ChunkResultSchema.safeParse(row.result)
    // A result that no longer fits the shape is read again rather than trusted
    return parsed.success ? [{ index: row.index, result: parsed.data }] : []
  })
}

// Reads a few chunks at a time, so one slow chunk does not hold up the others
async function readChunks(
  chunks: { index: number; text: string; context: string }[],
  totalChunks: number,
  signal: AbortSignal,
  onResult: (index: number, result: ChunkResult) => Promise<void>
): Promise<void> {
  for (let at = 0; at < chunks.length; at += CHUNK_CONCURRENCY) {
    const batch = chunks.slice(at, at + CHUNK_CONCURRENCY)
    const results = await Promise.all(batch.map((chunk) => analyzeChunk(chunk, totalChunks, signal)))
    for (const [offset, result] of results.entries()) await onResult(batch[offset].index, result)
  }
}

/**
 * Moves one meeting's analysis forward and says whether there is more to do. The caller keeps
 * calling while `hasMore` is true.
 */
export async function runAnalysis(id: string, { signal }: RunOptions): Promise<MeetingRunState | null> {
  await connectDatabase()
  const meeting = await MeetingModel.findById(id)
  if (!meeting) return null

  const meetingId = meeting._id as mongoose.Types.ObjectId
  const transcriptHash = meeting.transcriptHash
  const chunks = splitTranscript(meeting.transcript)
  const totalChunks = chunks.length

  // Already analyzed, and the transcript has not changed since
  if (meeting.status === "completed" && meeting.analyzedHash === transcriptHash) {
    return { status: "completed", statusMessage: null, progress: { analyzedChunks: totalChunks, totalChunks }, hasMore: false }
  }

  try {
    // Results from an older transcript are dropped, so an edited meeting is read again in full
    await MeetingChunk.deleteMany({ meetingId, transcriptHash: { $ne: transcriptHash } })

    const done = await storedResults(meetingId, transcriptHash)
    const doneIndexes = new Set(done.map((entry) => entry.index))
    const pending = chunks.filter((chunk) => !doneIndexes.has(chunk.index))

    if (pending.length > 0) {
      await MeetingModel.updateOne(
        { _id: meetingId },
        { status: "analyzing", statusMessage: null, totalChunks, analyzedChunks: done.length }
      )
      const batch = pending.slice(0, CHUNKS_PER_REQUEST)
      let analyzed = done.length
      await readChunks(batch, totalChunks, signal, async (index, result) => {
        // The unique index on (meeting, transcript, part) means a repeated run cannot store twice
        await MeetingChunk.updateOne(
          { meetingId, transcriptHash, index },
          { $set: { result } },
          { upsert: true }
        )
        analyzed += 1
        await MeetingModel.updateOne({ _id: meetingId }, { analyzedChunks: analyzed })
      })

      const remaining = pending.length - batch.length
      // Reading the last chunk is not the end: the meeting still has to be put together, which the
      // next call does, so this one always reports that there is more to do
      if (remaining === 0) await MeetingModel.updateOne({ _id: meetingId }, { status: "summarizing" })
      return {
        status: remaining > 0 ? "analyzing" : "summarizing",
        statusMessage: null,
        progress: { analyzedChunks: analyzed, totalChunks },
        hasMore: true,
      }
    }

    // Every part has been read: put the meeting together
    await MeetingModel.updateOne({ _id: meetingId }, { status: "summarizing", statusMessage: null, analyzedChunks: totalChunks, totalChunks })
    const { analysis, title } = await synthesizeMeeting(done, {
      userTitle: meeting.isTitleGenerated ? null : meeting.title,
      signal,
      onFold: (remaining) => console.info(`Meeting ${id}: folding notes into ${remaining} groups`),
    })

    await MeetingModel.updateOne(
      { _id: meetingId },
      {
        analysis,
        title,
        analyzedHash: transcriptHash,
        analyzedAt: new Date(),
        status: "completed",
        statusMessage: null,
        analyzedChunks: totalChunks,
        totalChunks,
      }
    )
    console.info("Meeting analyzed:", JSON.stringify({ id, chunks: totalChunks, characters: meeting.transcriptChars, participants: analysis.participantCount }))
    return { status: "completed", statusMessage: null, progress: { analyzedChunks: totalChunks, totalChunks }, hasMore: false }
  } catch (error: unknown) {
    if (signal.aborted) throw error
    // The transcript and every chunk already read stay exactly as they are
    const message = error instanceof Error ? error.message : String(error)
    console.error("Meeting analysis failed:", JSON.stringify({ id, message: message.slice(0, 200) }))
    const analyzed = await MeetingChunk.countDocuments({ meetingId, transcriptHash })
    await MeetingModel.updateOne({ _id: meetingId }, { status: "failed", statusMessage: message.slice(0, 300), analyzedChunks: analyzed, totalChunks })
    return { status: "failed", statusMessage: message.slice(0, 300), progress: { analyzedChunks: analyzed, totalChunks }, hasMore: false }
  }
}

/**
 * Throws away what was read and starts again, for a transcript that changed or an analysis the
 * user wants rebuilt. The transcript and the meeting itself are untouched.
 */
export async function resetAnalysis(id: string): Promise<boolean> {
  await connectDatabase()
  const meeting = await MeetingModel.findById(id)
  if (!meeting) return false
  await MeetingChunk.deleteMany({ meetingId: meeting._id })
  await MeetingModel.updateOne(
    { _id: meeting._id },
    { status: "saved", statusMessage: null, analyzedChunks: 0, totalChunks: splitTranscript(meeting.transcript).length, analysisProvider: null, analysisProviders: [] }
  )
  return true
}

/** Adds one call's source to the meeting's analysis: the last provider to answer, and every provider that has. */
export async function noteAnalysisSource(id: string, source: AiSource): Promise<void> {
  if (!source.provider) return
  await connectDatabase()
  await MeetingModel.updateOne({ _id: id }, { $set: { analysisProvider: source.provider }, $addToSet: { analysisProviders: { $each: source.providers } } })
}

export const isRunning = (status: string) => (runningStates as readonly string[]).includes(status)
