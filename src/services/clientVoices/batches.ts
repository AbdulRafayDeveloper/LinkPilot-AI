import { connectDatabase } from "@/lib/db"
import { allOf, createdBetween, escapeForSearch } from "@/lib/listQuery"
import { deleteObject, isStorageConfigured } from "@/services/storage/s3"
import { getClient } from "@/services/clientMessaging/clients"
import { ownedBy, visibleById, visibleTo } from "@/services/auth/viewer"
import { ClientVoiceModel } from "@/models/ClientVoice"
import { ClientVoiceTasksModel, type IClientVoiceTasks } from "@/models/ClientVoiceTasks"
import { HISTORY_PAGE_SIZE } from "@/constants/historyFilters"
import { NO_CLIENT_FILTER } from "@/constants/clientVoices"
import { toVoice, voiceLinks, voicesIn } from "./records"
import type { Viewer } from "@/types/auth"
import type { ClientQuestion, ClientTask, VoiceBatch, VoiceBatchDetail, VoiceBatchesPage } from "@/types/clientVoices"

/**
 * A batch of voice messages, which is the record this module keeps.
 *
 * **Every batch is kept**, with or without a client: the record is written as the run starts, so
 * every voice has somewhere to belong and a task step that fails still leaves the recordings and
 * the transcripts saved. The lists are written onto it when they are ready, and the whole batch is
 * then read back on its own page with its recordings to play.
 *
 * The collection is `client_voice_tasks` and a voice points at its batch with `taskGroupId`: both
 * names are what is already stored, and this is a rename of what is read rather than of what is
 * written (see Personal Drive, which kept `important_files`).
 */

type StoredBatch = IClientVoiceTasks & { _id: { toString: () => string } }

const toBatch = (record: StoredBatch): VoiceBatch => ({
  id: record._id.toString(),
  title: record.title ?? "",
  clientId: record.clientId ?? "",
  clientName: record.clientName ?? "",
  voiceCount: record.voiceCount ?? record.voiceIds?.length ?? 0,
  tasks: (record.tasks ?? []).map((task) => ({ task: task.task, voices: task.voices ?? [] })),
  questions: (record.questions ?? []).map((entry) => ({ question: entry.question, voices: entry.voices ?? [] })),
  missingVoices: record.missingVoices ?? [],
  provider: record.provider ?? null,
  providers: record.providers ?? [],
  editedAt: record.editedAt ? new Date(record.editedAt).toISOString() : null,
  createdAt: new Date(record.createdAt).toISOString(),
})

/**
 * The client a batch is kept under. A client that has been deleted since it was chosen leaves the
 * batch under no client rather than failing the run: the recordings matter more than the label, and
 * the page's own picker falls back to none for the same reason.
 */
async function clientFor(viewer: Viewer, clientId: string): Promise<{ clientId: string; clientName: string }> {
  if (!clientId) return { clientId: "", clientName: "" }
  const client = await getClient(viewer, clientId)
  return client ? { clientId, clientName: client.name } : { clientId: "", clientName: "" }
}

/**
 * Starts a batch, before a single voice is written out, so nothing that follows can be left with
 * nowhere to belong. The lists arrive later through `finishBatch`.
 */
export async function startBatch(viewer: Viewer, input: { clientId: string; title?: string; voiceCount: number }): Promise<VoiceBatch> {
  const client = await clientFor(viewer, input.clientId)
  await connectDatabase()
  const record = await ClientVoiceTasksModel.create({
    ownerId: viewer.id,
    ...client,
    title: input.title?.trim() ?? "",
    voiceCount: input.voiceCount,
  })
  return toBatch(record.toObject() as StoredBatch)
}

/** How many voices went in, kept in step when a batch is run again for the voices that failed. */
export async function noteVoiceCount(viewer: Viewer, batchId: string, voiceCount: number): Promise<void> {
  const filter = visibleById(viewer, batchId)
  if (!filter) return
  await connectDatabase()
  await ClientVoiceTasksModel.updateOne(filter, { $max: { voiceCount } })
}

/** The batch a voice is about to join, so the voice is always stamped with its batch's own client. */
export async function batchClient(viewer: Viewer, batchId: string): Promise<{ clientId: string; clientName: string } | null> {
  const filter = visibleById(viewer, batchId)
  if (!filter) return null
  await connectDatabase()
  const record = (await ClientVoiceTasksModel.findOne(filter, { clientId: 1, clientName: 1 }).lean()) as StoredBatch | null
  return record ? { clientId: record.clientId ?? "", clientName: record.clientName ?? "" } : null
}

interface FinishInput {
  tasks: ClientTask[]
  questions: ClientQuestion[]
  missingVoices: number[]
  voiceIds: string[]
  provider: string | null
  providers: string[]
  // A title written from the voices, used only where the user gave the batch none of their own
  suggestedTitle: string
}

/**
 * Writes what the batch produced onto it. Another account's batch reads as not found.
 *
 * **The title the model wrote is only ever a fallback**: it is put on in the same atomic update,
 * and only where the batch has none, so a name the user typed as the run started can never be
 * replaced by one written from the voices.
 */
export async function finishBatch(viewer: Viewer, batchId: string, input: FinishInput): Promise<VoiceBatch | null> {
  const filter = visibleById(viewer, batchId)
  if (!filter) return null
  await connectDatabase()
  const record = (await ClientVoiceTasksModel.findOneAndUpdate(
    filter,
    [
      {
        $set: {
          tasks: input.tasks,
          questions: input.questions,
          missingVoices: input.missingVoices,
          voiceIds: input.voiceIds,
          provider: input.provider,
          providers: input.providers,
          title: { $cond: [{ $eq: [{ $ifNull: ["$title", ""] }, ""] }, input.suggestedTitle, "$title"] },
        },
      },
    ],
    // Mongoose refuses an array of stages without this, and the refusal would be swallowed here
    { new: true, lean: true, updatePipeline: true }
  )) as StoredBatch | null
  return record ? toBatch(record) : null
}

/** What the list and a bulk delete are narrowed by, so the two can never cover different batches. */
export interface BatchFilters {
  search: string
  // A client's id, NO_CLIENT_FILTER for the batches kept under none, or "" for every batch
  client: string
  from: string | null
  to: string | null
}

/**
 * A search covers whose batch it is and what came out of it, which is what someone looking for a
 * batch remembers: the client's name, a task, or a question. It is escaped, so it stays plain text.
 */
function searchCondition(search: string): Record<string, unknown> | null {
  const term = search.trim()
  if (!term) return null
  const pattern = new RegExp(escapeForSearch(term), "i")
  return { $or: [{ title: pattern }, { clientName: pattern }, { "tasks.task": pattern }, { "questions.question": pattern }] }
}

// "No client" is every batch that names none, whether it was stored as "" or never set at all
const clientCondition = (client: string): Record<string, unknown> | null =>
  client === NO_CLIENT_FILTER ? { clientId: { $in: ["", null] } } : client ? { clientId: client } : null

function matchingFilter(viewer: Viewer, filters: BatchFilters, scope: Record<string, unknown>): Record<string, unknown> {
  return allOf([scope, searchCondition(filters.search), clientCondition(filters.client), createdBetween(filters.from, filters.to)])
}

/**
 * The clients these batches were kept under, for the filter. Only the records can say which ones
 * are really there, so they are read from the batches rather than from the client list: a client
 * deleted since is still what the batch says, and still finds it.
 */
async function batchClients(viewer: Viewer): Promise<{ id: string; name: string }[]> {
  const rows = (await ClientVoiceTasksModel.aggregate([
    { $match: { ...visibleTo(viewer), clientId: { $nin: ["", null] } } },
    { $group: { _id: "$clientId", name: { $last: "$clientName" } } },
    { $sort: { name: 1 } },
  ])) as { _id: string; name: string | null }[]
  return rows.map((row) => ({ id: row._id, name: row.name || "A client that has gone" }))
}

/**
 * Every batch, newest first, exactly HISTORY_PAGE_SIZE to a page. The page size is enforced here
 * rather than on the page, and a page past the end comes back as the last one.
 */
export async function listBatches(viewer: Viewer, filters: BatchFilters & { page: number }): Promise<VoiceBatchesPage> {
  await connectDatabase()
  const matching = matchingFilter(viewer, filters, visibleTo(viewer))
  const [total, clients] = await Promise.all([ClientVoiceTasksModel.countDocuments(matching), batchClients(viewer)])
  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE))
  const page = Math.min(Math.max(1, filters.page), totalPages)
  const records = (await ClientVoiceTasksModel.find(matching)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * HISTORY_PAGE_SIZE)
    .limit(HISTORY_PAGE_SIZE)
    .lean()) as StoredBatch[]
  return { items: records.map(toBatch), total, page, pageSize: HISTORY_PAGE_SIZE, totalPages, clients }
}

/**
 * One batch with everything that came out of it, and a fresh signed link per recording, so the page
 * plays them without asking for anything else. Another account's batch reads as not found.
 */
export async function batchDetail(viewer: Viewer, id: string): Promise<VoiceBatchDetail | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const record = (await ClientVoiceTasksModel.findOne(filter).lean()) as StoredBatch | null
  if (!record) return null
  const stored = await voicesIn(viewer, [id])
  const voices = await Promise.all(
    stored.map(async (voice) => ({ ...toVoice(voice), ...(await voiceLinks(voice)) }))
  )
  return { ...toBatch(record), voices }
}

/**
 * The user's own wording of a kept batch. **Only what is named is written**, so renaming a batch
 * never carries a stale list over what another tab saved, and the voices it was made from are
 * untouched either way.
 */
export async function editBatchLists(
  viewer: Viewer,
  id: string,
  edit: { title?: string; tasks?: ClientTask[]; questions?: ClientQuestion[] }
): Promise<VoiceBatch | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const record = (await ClientVoiceTasksModel.findOneAndUpdate(
    filter,
    {
      $set: {
        ...(edit.title !== undefined ? { title: edit.title } : {}),
        ...(edit.tasks ? { tasks: edit.tasks } : {}),
        ...(edit.questions ? { questions: edit.questions } : {}),
        editedAt: new Date(),
      },
    },
    { new: true, lean: true }
  )) as StoredBatch | null
  return record ? toBatch(record) : null
}

/**
 * Deletes the batches named, or every batch the filters cover, with their voices and their
 * recordings. The recordings go **first**, one at a time: a recording this loses track of is the
 * one failure worth telling the user about, so a storage failure leaves that batch listed and is
 * counted in `failed`, exactly as Personal Drive does it.
 */
export async function deleteBatches(viewer: Viewer, filters: BatchFilters, ids?: string[]): Promise<{ deleted: number; failed: number }> {
  // An id that is not one matches nothing, rather than reaching the database as something to cast
  const named = ids?.filter((id) => /^[0-9a-f]{24}$/.test(id))
  if (named && named.length === 0) return { deleted: 0, failed: 0 }
  await connectDatabase()
  // Ticked rows are what the viewer can see; a whole filter only ever takes their own records
  const matching = matchingFilter(viewer, filters, named ? visibleTo(viewer) : ownedBy(viewer))
  const records = (await ClientVoiceTasksModel.find(
    named ? allOf([matching, { _id: { $in: named } }]) : matching,
    { _id: 1 }
  ).lean()) as StoredBatch[]
  if (records.length === 0) return { deleted: 0, failed: 0 }

  const batchIds = records.map((record) => record._id.toString())
  const voices = await voicesIn(viewer, batchIds)
  const broken = new Set<string>()
  if (isStorageConfigured()) {
    for (const voice of voices) {
      if (!voice.storageKey) continue
      try {
        await deleteObject(voice.storageKey)
      } catch (error: unknown) {
        console.error("❌ Could not remove a client voice recording:", error instanceof Error ? error.message : error)
        broken.add(voice.taskGroupId ?? "")
      }
    }
  }

  // A batch whose recording could not be removed stays whole, so nothing is ever lost track of
  const goes = batchIds.filter((id) => !broken.has(id))
  if (goes.length > 0) {
    await ClientVoiceModel.deleteMany({ ...visibleTo(viewer), taskGroupId: { $in: goes } })
    await ClientVoiceTasksModel.deleteMany({ ...matching, _id: { $in: goes } })
  }
  return { deleted: goes.length, failed: broken.size }
}
