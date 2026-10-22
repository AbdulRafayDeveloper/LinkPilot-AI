import { Types } from "mongoose"
import { connectDatabase } from "@/lib/db"
import { deleteObject, isStorageConfigured, presignDownload, putObject } from "@/services/storage/s3"
import { visibleById, visibleTo } from "@/services/auth/viewer"
import { ClientVoiceModel, type IClientVoice } from "@/models/ClientVoice"
import { VOICE_STORAGE_PREFIX } from "@/constants/clientVoices"
import type { Viewer } from "@/types/auth"
import type { SavedVoice } from "@/types/clientVoices"

/**
 * One kept voice message: the recording in S3, and the record that says what it is.
 *
 * **Every voice of every batch is kept**, at the owner's request that no voice is ever lost, so
 * nothing here asks whether a client was chosen: the batch says that, and the voice simply joins
 * the batch. A recording is only ever reached through a signed link that expires, so the bucket
 * stays private, and everything is scoped to the account.
 */

type StoredVoice = IClientVoice & { _id: { toString: () => string } }

const cleanName = (name: string) => name.replace(/[^\w.\- ]+/g, "_").slice(0, 80) || "voice"

export const toVoice = (record: StoredVoice): SavedVoice => ({
  id: record._id.toString(),
  // Stored as `taskGroupId`, read as the batch it belongs to (models/ClientVoice.ts)
  batchId: record.taskGroupId ?? null,
  clientId: record.clientId ?? "",
  clientName: record.clientName ?? "",
  position: record.position,
  name: record.name,
  size: record.size,
  contentType: record.contentType,
  transcript: record.transcript,
  transcribedBy: record.transcribedBy ?? null,
  createdAt: new Date(record.createdAt).toISOString(),
})

interface SaveVoiceInput {
  // The batch it arrived in, which is also where its client comes from
  batchId: string
  clientId: string
  clientName: string
  position: number
  name: string
  contentType: string
  transcript: string
  transcribedBy: string | null
  audio: Buffer
}

/**
 * Keeps one voice of a batch: the recording in S3, then the record only once it is really there.
 *
 * **Without file storage the record is still written**, with no `storageKey`, because the transcript
 * is what most of the value is and losing it as well would be the worse half of the same failure.
 * Such a voice says plainly on its batch's page that the recording was not kept.
 */
export async function saveVoice(viewer: Viewer, input: SaveVoiceInput): Promise<SavedVoice> {
  await connectDatabase()
  // The id is settled before anything is written, so the key is built on the server and holds it:
  // two voices with the same name never land on each other, and the record is never half made
  const id = new Types.ObjectId()
  const canStore = isStorageConfigured()
  const storageKey = canStore ? `${VOICE_STORAGE_PREFIX}/${id.toString()}-${cleanName(input.name)}` : ""
  const record = await ClientVoiceModel.create({
    _id: id,
    ownerId: viewer.dataOwnerId,
    taskGroupId: input.batchId,
    clientId: input.clientId,
    clientName: input.clientName,
    position: input.position,
    name: cleanName(input.name),
    size: input.audio.byteLength,
    contentType: input.contentType,
    storageKey,
    transcript: input.transcript,
    transcribedBy: input.transcribedBy,
  })
  if (storageKey) {
    try {
      await putObject(storageKey, input.audio, input.contentType)
    } catch (error: unknown) {
      // Nothing points at a recording that was never stored
      await ClientVoiceModel.deleteOne({ _id: id })
      throw error
    }
  }
  return toVoice(record.toObject() as StoredVoice)
}

/** The voices of these batches, in the order they arrived. */
export async function voicesIn(viewer: Viewer, batchIds: string[]): Promise<StoredVoice[]> {
  if (batchIds.length === 0) return []
  await connectDatabase()
  return (await ClientVoiceModel.find({ ...visibleTo(viewer), taskGroupId: { $in: batchIds } })
    .sort({ position: 1, createdAt: 1 })
    .lean()) as StoredVoice[]
}

/**
 * The links one voice is played and saved by. Played inline, so the browser's own player takes it;
 * saved as an attachment, so it keeps its name. Both are null for a recording that was never stored.
 */
export async function voiceLinks(record: { storageKey: string; contentType: string; name: string }) {
  if (!record.storageKey || !isStorageConfigured()) return { playUrl: null, downloadUrl: null }
  const [playUrl, downloadUrl] = await Promise.all([
    presignDownload(record.storageKey, record.contentType),
    presignDownload(record.storageKey, record.contentType, record.name),
  ])
  return { playUrl, downloadUrl }
}

/** A short-lived link to download one recording; the bucket itself stays private. */
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
