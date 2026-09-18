import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { Meeting as MeetingModel, type IMeeting } from "@/models/Meeting"
import { MeetingChunk } from "@/models/MeetingChunk"
import { deleteMeetingVectors } from "@/services/meetingPlanner/vectors"
import { clearMeetingChat } from "@/services/meetingPlanner/chatHistory"
import { countChunks, hashTranscript } from "@/lib/transcriptChunks"
import { MEETINGS_PAGE_SIZE, type MeetingStatusId } from "@/constants/meetings"
import type { Meeting, MeetingAnalysis, MeetingInput, MeetingSummary, MeetingsPage } from "@/types/meetings"
import type { Viewer } from "@/types/auth"
import { ownedBy, visibleById, visibleTo } from "@/services/auth/viewer"
import type { AiSource } from "@/types/ai"
import type { StoredRecording } from "@/types/meetingRecording"
import { removeRecordingFiles, toRecordingSummary } from "@/services/meetings/recording"

/**
 * Meetings in the database. The history list never reads a transcript: a card needs a title, a
 * status and a few numbers, while transcripts run to hundreds of thousands of characters, so the
 * transcript is read only when one meeting is opened.
 */
type StoredMeeting = IMeeting & { _id: { toString: () => string } }

const CURSOR_SEPARATOR = "|"
const ID_PATTERN = /^[0-9a-f]{24}$/
// Everything a card needs, and nothing else
const SUMMARY_FIELDS = {
  title: 1,
  isTitleGenerated: 1,
  status: 1,
  statusMessage: 1,
  transcriptChars: 1,
  totalChunks: 1,
  analyzedChunks: 1,
  analyzedHash: 1,
  transcriptHash: 1,
  createdAt: 1,
  updatedAt: 1,
  "analysis.participantCount": 1,
  "analysis.purpose": 1,
} as const

const analysisOf = (record: StoredMeeting): MeetingAnalysis | null => (record.analysis as MeetingAnalysis | null) ?? null

function toSummary(record: StoredMeeting): MeetingSummary {
  const analysis = analysisOf(record)
  return {
    id: record._id.toString(),
    title: record.title,
    isTitleGenerated: record.isTitleGenerated,
    status: record.status as MeetingStatusId,
    statusMessage: record.statusMessage,
    transcriptChars: record.transcriptChars,
    participantCount: analysis?.participantCount ?? null,
    purpose: analysis?.purpose ?? null,
    progress: { analyzedChunks: record.analyzedChunks, totalChunks: record.totalChunks },
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function toMeeting(record: StoredMeeting): Meeting {
  return {
    ...toSummary(record),
    transcript: record.transcript,
    analysis: analysisOf(record),
    // An analysis built from a different transcript than the one saved now is out of date
    isAnalysisStale: Boolean(record.analyzedHash) && record.analyzedHash !== record.transcriptHash,
    analyzedAt: record.analyzedAt ? record.analyzedAt.toISOString() : null,
    analysisSource: { provider: (record.analysisProvider as AiSource["provider"]) ?? null, providers: (record.analysisProviders ?? []) as AiSource["providers"] },
    notes: record.notes ?? "",
    notesEditedAt: record.notesEditedAt ? new Date(record.notesEditedAt).toISOString() : null,
    recording: record.recording ? toRecordingSummary(record.recording as StoredRecording) : null,
  }
}

/**
 * Keeps the user's own wording of the notes. From then on a new analysis leaves them alone, since
 * they are the user's now; clearing them lets the next analysis write them again.
 */
export async function saveNotes(viewer: Viewer, id: string, notes: string): Promise<Meeting | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const updated = await MeetingModel.findOneAndUpdate(
    filter,
    { $set: { notes, notesEditedAt: notes.trim() ? new Date() : null } },
    { returnDocument: "after" }
  ).lean()
  return updated ? toMeeting(updated as unknown as StoredMeeting) : null
}

const toCursor = (record: StoredMeeting) => `${record.createdAt.toISOString()}${CURSOR_SEPARATOR}${record._id.toString()}`

// The search term is plain text: anything the regular expression engine would read is escaped
const escapeForSearch = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)

// Everything older than the meeting the cursor points at; an unreadable cursor starts again
function olderThan(cursor: string | null) {
  const [time, id] = (cursor ?? "").split(CURSOR_SEPARATOR)
  const createdAt = new Date(time ?? "")
  if (!cursor || Number.isNaN(createdAt.getTime()) || !ID_PATTERN.test(id ?? "")) return []
  const objectId = new mongoose.Types.ObjectId(id)
  return [{ $or: [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: objectId } }] }]
}

interface ListOptions {
  search?: string
  status?: MeetingStatusId | null
  cursor?: string | null
  limit?: number
}

/**
 * One page of the history, newest first, for the current search and status. The search runs in
 * the database against the meeting name, and the cursor is part of the same query, so paging a
 * searched or filtered list neither skips nor repeats a meeting.
 */
export async function listMeetings(viewer: Viewer, { search = "", status = null, cursor = null, limit = MEETINGS_PAGE_SIZE }: ListOptions = {}): Promise<MeetingsPage> {
  await connectDatabase()
  const size = Math.min(Math.max(1, Math.trunc(limit) || MEETINGS_PAGE_SIZE), MEETINGS_PAGE_SIZE)
  const term = search.trim()
  const narrowing = [
    visibleTo(viewer),
    ...(term ? [{ title: new RegExp(escapeForSearch(term), "i") }] : []),
    ...(status ? [{ status }] : []),
  ]
  const asFilter = (conditions: object[]) => (conditions.length > 0 ? { $and: conditions } : {})

  const [records, total] = await Promise.all([
    MeetingModel.find(asFilter([...narrowing, ...olderThan(cursor)]), SUMMARY_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .limit(size + 1)
      .lean(),
    // The total counts what the search and filter match, so the header follows them
    MeetingModel.countDocuments(asFilter(narrowing)),
  ])
  const stored = records as unknown as StoredMeeting[]
  const batch = stored.slice(0, size)
  return {
    meetings: batch.map(toSummary),
    nextCursor: stored.length > size && batch.length > 0 ? toCursor(batch[batch.length - 1]) : null,
    total,
  }
}

export async function getMeeting(viewer: Viewer, id: string): Promise<Meeting | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const record = await MeetingModel.findOne(filter).lean()
  return record ? toMeeting(record as unknown as StoredMeeting) : null
}

/**
 * Saves a meeting before anything is analyzed, so the transcript is safe from the first moment.
 * A meeting with no name of its own gets a working one until the analysis writes a real title.
 */
export async function createMeeting(viewer: Viewer, { title, transcript }: MeetingInput): Promise<Meeting> {
  await connectDatabase()
  const named = (title ?? "").trim()
  const record = await MeetingModel.create({
    ownerId: viewer.id,
    title: named || "Untitled meeting",
    isTitleGenerated: named === "",
    transcript,
    transcriptChars: transcript.length,
    transcriptHash: hashTranscript(transcript),
    status: "saved",
    totalChunks: countChunks(transcript),
    analyzedChunks: 0,
  })
  return toMeeting(record as unknown as StoredMeeting)
}

/**
 * Changes a meeting's name, its transcript, or both. A changed transcript makes the analysis out
 * of date: the notes read from the old transcript go, the meeting is marked as needing another
 * run, and the page says plainly that what it shows came from the earlier transcript.
 */
export async function updateMeeting(viewer: Viewer, id: string, { title, transcript }: MeetingInput): Promise<Meeting | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const meeting = await MeetingModel.findOne(filter)
  if (!meeting) return null

  const named = (title ?? "").trim()
  const changes: Record<string, unknown> = {}
  if (named && named !== meeting.title) {
    changes.title = named
    changes.isTitleGenerated = false
  }

  if (transcript !== meeting.transcript) {
    changes.transcript = transcript
    changes.transcriptChars = transcript.length
    changes.transcriptHash = hashTranscript(transcript)
    changes.totalChunks = countChunks(transcript)
    changes.analyzedChunks = 0
    changes.statusMessage = null
    // Notes read from the old transcript are no use for the new one
    await MeetingChunk.deleteMany({ meetingId: meeting._id })
    changes.status = meeting.analyzedHash ? "stale" : "saved"
  }

  const updated = await MeetingModel.findByIdAndUpdate(id, changes, { returnDocument: "after", runValidators: true }).lean()
  return updated ? toMeeting(updated as unknown as StoredMeeting) : null
}

/**
 * Deletes one meeting and everything read from it, so nothing is left behind.
 */
export async function deleteMeeting(viewer: Viewer, id: string): Promise<boolean> {
  const filter = visibleById(viewer, id)
  if (!filter) return false
  await connectDatabase()
  // The recording is read first: its files are named from it, and they go once the meeting has
  const recording = ((await MeetingModel.findOne(filter, { recording: 1 }).lean()) as { recording?: unknown } | null)?.recording ?? null
  const { deletedCount } = await MeetingModel.deleteOne(filter)
  if (deletedCount > 0) {
    await Promise.all([
      MeetingChunk.deleteMany({ meetingId: new mongoose.Types.ObjectId(id) }),
      // What its chat was answered from, and the chat itself
      deleteMeetingVectors(id),
      clearMeetingChat(id),
      removeRecordingFiles(id, recording),
    ])
  }
  return deletedCount > 0
}

/**
 * Deletes several meetings at once: the ones named by `ids`, or every meeting the search and status
 * cover when `ids` is left out. Everything read from each meeting goes with it (its chunks, what its
 * chat was answered from, and the chat), exactly as deleting one does, so nothing is left behind.
 * Both forms stay inside what the viewer may see. Answers how many meetings really went.
 */
export async function deleteMeetings(
  viewer: Viewer,
  { search = "", status = null }: { search?: string; status?: string | null },
  ids?: string[]
): Promise<{ deleted: number }> {
  await connectDatabase()
  const term = search.trim()
  // Ticked rows follow the per-record delete; a whole filter never reaches another account's meetings
  const narrowing = [
    ids ? visibleTo(viewer) : ownedBy(viewer),
    ...(term ? [{ title: new RegExp(escapeForSearch(term), "i") }] : []),
    ...(status ? [{ status }] : []),
    ...(ids ? [{ _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } }] : []),
  ]
  // The ids are read first, because what each meeting left behind is keyed by them
  const found = (await MeetingModel.find({ $and: narrowing }, { _id: 1, recording: 1 }).lean()) as unknown as { _id: unknown; recording?: unknown }[]
  const doomed = found.map((record) => String(record._id))
  if (doomed.length === 0) return { deleted: 0 }
  const { deletedCount } = await MeetingModel.deleteMany({ _id: { $in: doomed.map((id) => new mongoose.Types.ObjectId(id)) } })
  await Promise.all([
    MeetingChunk.deleteMany({ meetingId: { $in: doomed.map((id) => new mongoose.Types.ObjectId(id)) } }),
    ...doomed.flatMap((id) => [deleteMeetingVectors(id), clearMeetingChat(id)]),
    // A recorded meeting's files go with it
    ...found.map((record) => removeRecordingFiles(String(record._id), record.recording ?? null)),
  ])
  return { deleted: deletedCount ?? 0 }
}
