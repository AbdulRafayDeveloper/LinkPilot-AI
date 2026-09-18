import { Types } from "mongoose"
import { connectDatabase } from "@/lib/db"
import { deleteObject, isStorageConfigured, presignDownload, putObject } from "@/services/storage/s3"
import { getClient } from "@/services/clientMessaging/clients"
import { ownedBy, visibleById, visibleTo } from "@/services/auth/viewer"
import { ClientVoiceModel, type IClientVoice } from "@/models/ClientVoice"
import { ClientVoiceTasksModel, type IClientVoiceTasks } from "@/models/ClientVoiceTasks"
import { CLIENT_VOICES_MESSAGES, SAVED_VOICES_PAGE_SIZE, VOICE_STORAGE_PREFIX } from "@/constants/clientVoices"
import { UserFacingError } from "@/lib/errors"
import type { Viewer } from "@/types/auth"
import type { ClientTask, SavedVoice, SavedVoiceTasks, SavedVoicesPage } from "@/types/clientVoices"

/**
 * A client's voices, kept.
 *
 * A batch with a client chosen for it is saved: the recording goes to S3 and this writes what the
 * app knows about it, so it can be played, read and deleted later, and the task list made from it is
 * kept with it and can be edited. A batch with no client still stores nothing, exactly as before.
 * Everything is scoped to the account, and a recording is only ever reached through a signed link
 * that expires, so the bucket stays private.
 */

type StoredVoice = IClientVoice & { _id: { toString: () => string } }
type StoredTasks = IClientVoiceTasks & { _id: { toString: () => string } }

const cleanName = (name: string) => name.replace(/[^\w.\- ]+/g, "_").slice(0, 80) || "voice"

const toVoice = (record: StoredVoice): SavedVoice => ({
  id: record._id.toString(),
  clientId: record.clientId,
  clientName: record.clientName,
  position: record.position,
  name: record.name,
  size: record.size,
  contentType: record.contentType,
  transcript: record.transcript,
  transcribedBy: record.transcribedBy ?? null,
  taskGroupId: record.taskGroupId ?? null,
  createdAt: new Date(record.createdAt).toISOString(),
})

const toTasks = (record: StoredTasks): SavedVoiceTasks => ({
  id: record._id.toString(),
  clientId: record.clientId,
  clientName: record.clientName,
  tasks: record.tasks.map((task) => ({ task: task.task, voices: task.voices ?? [] })),
  voiceIds: record.voiceIds ?? [],
  missingVoices: record.missingVoices ?? [],
  editedAt: record.editedAt ? new Date(record.editedAt).toISOString() : null,
  createdAt: new Date(record.createdAt).toISOString(),
})

/** The client a batch belongs to, checked against the account before anything is written. */
async function requireClientName(viewer: Viewer, clientId: string): Promise<string> {
  const client = await getClient(viewer, clientId)
  if (!client) throw new UserFacingError(CLIENT_VOICES_MESSAGES.clientMissing)
  return client.name
}

interface SaveVoiceInput {
  clientId: string
  position: number
  name: string
  contentType: string
  transcript: string
  transcribedBy: string | null
  audio: Buffer
}

/** Keeps one voice of a client: the recording in S3 first, the record only once it is really there. */
export async function saveVoice(viewer: Viewer, input: SaveVoiceInput): Promise<SavedVoice> {
  if (!isStorageConfigured()) throw new UserFacingError(CLIENT_VOICES_MESSAGES.storageUnavailable)
  const clientName = await requireClientName(viewer, input.clientId)
  await connectDatabase()
  // The id is settled before anything is written, so the key is built on the server and holds it:
  // two voices with the same name never land on each other, and the record is never half made
  const id = new Types.ObjectId()
  const storageKey = `${VOICE_STORAGE_PREFIX}/${id.toString()}-${cleanName(input.name)}`
  const record = await ClientVoiceModel.create({
    _id: id,
    ownerId: viewer.id,
    clientId: input.clientId,
    clientName,
    position: input.position,
    name: cleanName(input.name),
    size: input.audio.byteLength,
    contentType: input.contentType,
    storageKey,
    transcript: input.transcript,
    transcribedBy: input.transcribedBy,
  })
  try {
    await putObject(storageKey, input.audio, input.contentType)
  } catch (error: unknown) {
    // Nothing points at a recording that was never stored
    await ClientVoiceModel.deleteOne({ _id: id })
    throw error
  }
  return toVoice(record.toObject() as StoredVoice)
}

/** One client's saved voices, or every client's, newest first. */
export async function listVoices(viewer: Viewer, clientId: string | null, page: number): Promise<SavedVoicesPage> {
  await connectDatabase()
  const filter = { ...visibleTo(viewer), ...(clientId ? { clientId } : {}) }
  const current = Math.max(1, page)
  const [records, total] = await Promise.all([
    ClientVoiceModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((current - 1) * SAVED_VOICES_PAGE_SIZE)
      .limit(SAVED_VOICES_PAGE_SIZE)
      .lean() as Promise<StoredVoice[]>,
    ClientVoiceModel.countDocuments(filter),
  ])
  const groupIds = [...new Set(records.map((record) => record.taskGroupId).filter((id): id is string => Boolean(id)))]
  const groups = groupIds.length > 0 ? ((await ClientVoiceTasksModel.find({ ...visibleTo(viewer), _id: { $in: groupIds } }).lean()) as StoredTasks[]) : []
  return {
    voices: records.map(toVoice),
    taskGroups: groups.map(toTasks),
    total,
    page: current,
    totalPages: Math.max(1, Math.ceil(total / SAVED_VOICES_PAGE_SIZE)),
  }
}

/** A short-lived link to play or download one recording; the bucket itself stays private. */
export async function voiceLink(viewer: Viewer, id: string): Promise<string | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const record = (await ClientVoiceModel.findOne(filter).lean()) as StoredVoice | null
  if (!record?.storageKey) return null
  return presignDownload(record.storageKey, record.contentType, record.name)
}

/** Removes one voice: the recording first, so a failure never leaves a record pointing at nothing. */
export async function deleteVoice(viewer: Viewer, id: string): Promise<boolean> {
  const filter = visibleById(viewer, id)
  if (!filter) return false
  await connectDatabase()
  const record = (await ClientVoiceModel.findOne(filter).lean()) as StoredVoice | null
  if (!record) return false
  if (record.storageKey) await deleteObject(record.storageKey)
  await ClientVoiceModel.deleteOne({ _id: record._id })
  return true
}

/** Keeps the task list a batch produced, and points its voices at it. */
export async function saveTaskGroup(
  viewer: Viewer,
  input: { clientId: string; tasks: ClientTask[]; voiceIds: string[]; missingVoices: number[] }
): Promise<SavedVoiceTasks> {
  const clientName = await requireClientName(viewer, input.clientId)
  await connectDatabase()
  const record = await ClientVoiceTasksModel.create({
    ownerId: viewer.id,
    clientId: input.clientId,
    clientName,
    tasks: input.tasks,
    voiceIds: input.voiceIds,
    missingVoices: input.missingVoices,
  })
  const groupId = record._id.toString()
  if (input.voiceIds.length > 0) {
    await ClientVoiceModel.updateMany({ ...ownedBy(viewer), _id: { $in: input.voiceIds } }, { $set: { taskGroupId: groupId } })
  }
  return toTasks(record.toObject() as StoredTasks)
}

/** The user's own wording of a saved task list. The voices it was made from are untouched. */
export async function editTaskGroup(viewer: Viewer, id: string, tasks: ClientTask[]): Promise<SavedVoiceTasks | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const record = (await ClientVoiceTasksModel.findOneAndUpdate(
    filter,
    { $set: { tasks, editedAt: new Date() } },
    { new: true, lean: true }
  )) as StoredTasks | null
  return record ? toTasks(record) : null
}
