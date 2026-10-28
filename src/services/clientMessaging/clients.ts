import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { Client as ClientModel, type IClient } from "@/models/Client"
import { ClientProjectModel } from "@/models/ClientProject"
import mongoose from "mongoose"
import { CLIENT_MESSAGING_MESSAGES, SAMPLE_MESSAGE_COUNT } from "@/constants/clientMessaging"
import { CLIENT_PROJECT_STATUS_IDS, DEFAULT_CLIENT_KIND, clientKindOf, type ClientProjectStatus } from "@/constants/clients"
import type { Client, ClientInput } from "@/types/clientMessaging"
import type { Viewer } from "@/types/auth"
import { visibleById, visibleTo } from "@/services/auth/viewer"
import { deleteTasksOfProjects } from "@/services/clientProjects/tasks"
import { deleteFoldersOfProjects } from "@/services/clientProjects/folders"
import { deleteProjectFileUploads } from "@/services/clientProjects/files"
import { forgetProjects } from "@/services/meetingPlanner/clientProjects"

/**
 * The clients the user writes to, kept in the clients collection. Each one carries its own
 * message format and sample messages, which is what the generated message follows. A client belongs
 * to the account that added it: a user writes to their own clients, an admin sees them all.
 */

type StoredClient = IClient & { _id: { toString: () => string } }

function toClient(record: StoredClient, projectStatuses: ClientProjectStatus[] = []): Client {
  return {
    id: record._id.toString(),
    name: record.name,
    country: record.country,
    // A client saved before the kind was asked is an individual
    kind: clientKindOf(record.kind),
    messageFormat: record.messageFormat,
    // Always the agreed number of slots, so a client saved before a change still lines up
    sampleMessages: Array.from({ length: SAMPLE_MESSAGE_COUNT }, (_, index) => record.sampleMessages[index] ?? ""),
    projectStatuses,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

/**
 * Only the fields the client owns, each trimmed, with exactly SAMPLE_MESSAGE_COUNT samples. The kind
 * is written only when the request carries it, so Client Tasks Messaging's form, which never asks,
 * leaves an edited client's kind as it is.
 */
function cleanInput({ name, country, kind, messageFormat, sampleMessages }: ClientInput) {
  return {
    name: name.replace(/\s+/g, " ").trim(),
    country: country.replace(/\s+/g, " ").trim(),
    ...(kind === undefined ? {} : { kind }),
    messageFormat: messageFormat.trim(),
    sampleMessages: Array.from({ length: SAMPLE_MESSAGE_COUNT }, (_, index) => (sampleMessages[index] ?? "").trim()),
  }
}

/**
 * Every client the viewer may see, in the order they were dragged into (ties, from before ordering,
 * oldest first), each with the statuses its projects stand at, read in one grouped query for the
 * whole list, so the page can filter clients by their projects without asking per client.
 */
export async function listClients(viewer: Viewer): Promise<Client[]> {
  await connectDatabase()
  const [records, statuses] = await Promise.all([
    ClientModel.find(visibleTo(viewer)).sort({ position: 1, createdAt: 1, _id: 1 }).lean(),
    ClientProjectModel.aggregate<{ _id: string; statuses: string[] }>([
      { $match: visibleTo(viewer) },
      { $group: { _id: "$clientId", statuses: { $addToSet: "$status" } } },
    ]),
  ])
  const byClient = new Map(statuses.map((row) => [row._id, CLIENT_PROJECT_STATUS_IDS.filter((id) => row.statuses.includes(id))]))
  return (records as unknown as StoredClient[]).map((record) => toClient(record, byClient.get(record._id.toString()) ?? []))
}

/**
 * Puts the viewer's clients in the order they were dragged into, top to bottom. The order must name
 * every client the viewer may see, each once: a tab that missed one added or deleted elsewhere is
 * answered "changed" and reads the list again, rather than writing a partial order over a whole one.
 */
export async function reorderClients(viewer: Viewer, orderedIds: string[]): Promise<"saved" | "changed"> {
  await connectDatabase()
  const held = await ClientModel.find(visibleTo(viewer), { _id: 1 }).lean()
  const ids = new Set(held.map((record) => String(record._id)))
  if (ids.size !== orderedIds.length || orderedIds.some((id) => !ids.has(id))) return "changed"
  await ClientModel.bulkWrite(
    orderedIds.map((id, position) => ({
      updateOne: { filter: { _id: new mongoose.Types.ObjectId(id), ...visibleTo(viewer) }, update: { $set: { position } } },
    })),
    { ordered: false }
  )
  return "saved"
}

export async function getClient(viewer: Viewer, id: string): Promise<Client | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const record = await ClientModel.findOne(filter).lean()
  return record ? toClient(record as unknown as StoredClient) : null
}

export async function createClient(viewer: Viewer, input: ClientInput): Promise<Client> {
  await connectDatabase()
  // A new client goes to the end of the list, below everything already dragged into place
  const last = (await ClientModel.findOne(visibleTo(viewer), { position: 1 }).sort({ position: -1 }).lean()) as { position?: number } | null
  const position = last ? (last.position ?? 0) + 1 : 0
  const record = await ClientModel.create({ ownerId: viewer.id, kind: DEFAULT_CLIENT_KIND, position, ...cleanInput(input) })
  return toClient(record as unknown as StoredClient)
}

/**
 * Replaces a client's details. Returns null when the client no longer exists.
 */
export async function updateClient(viewer: Viewer, id: string, input: ClientInput): Promise<Client | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const record = await ClientModel.findOneAndUpdate(filter, cleanInput(input), {
    returnDocument: "after",
    runValidators: true,
  }).lean()
  return record ? toClient(record as unknown as StoredClient) : null
}

/**
 * Removes a client and the projects being done for them (models/ClientProject.ts), so a deleted
 * client can never leave projects behind pointing at nothing. Messages already written for them
 * stay in the history, which is a record of what was sent.
 */
export async function deleteClient(viewer: Viewer, id: string): Promise<boolean> {
  const filter = visibleById(viewer, id)
  if (!filter) return false
  await connectDatabase()
  const { deletedCount } = await ClientModel.deleteOne(filter)
  if (deletedCount > 0) {
    // The projects go, and each one's tasks with their images and voice notes go with them
    const projects = (await ClientProjectModel.find({ clientId: id }, { _id: 1 }).lean()) as unknown as { _id: { toString: () => string } }[]
    const projectIds = projects.map((project) => project._id.toString())
    await deleteTasksOfProjects(visibleTo(viewer), projectIds)
    // The folders those documents were filed in file nothing now
    await deleteFoldersOfProjects(projectIds)
    await deleteProjectFileUploads(visibleTo(viewer), projectIds)
    await forgetProjects(viewer, projectIds)
    await ClientProjectModel.deleteMany({ clientId: id })
  }
  return deletedCount > 0
}

/**
 * The client a message is being written for. Throws a message the user can act on when the
 * client was removed in another window, or belongs to another account.
 */
export async function requireClient(viewer: Viewer, id: string): Promise<Client> {
  const client = await getClient(viewer, id)
  if (!client) throw new UserFacingError(CLIENT_MESSAGING_MESSAGES.clientNotFound)
  return client
}
