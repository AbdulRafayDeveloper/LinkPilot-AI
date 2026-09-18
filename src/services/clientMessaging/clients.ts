import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { Client as ClientModel, type IClient } from "@/models/Client"
import { ClientProjectModel } from "@/models/ClientProject"
import { CLIENT_MESSAGING_MESSAGES, SAMPLE_MESSAGE_COUNT } from "@/constants/clientMessaging"
import type { Client, ClientInput } from "@/types/clientMessaging"
import type { Viewer } from "@/types/auth"
import { visibleById, visibleTo } from "@/services/auth/viewer"

/**
 * The clients the user writes to, kept in the clients collection. Each one carries its own
 * message format and sample messages, which is what the generated message follows. A client belongs
 * to the account that added it: a user writes to their own clients, an admin sees them all.
 */

type StoredClient = IClient & { _id: { toString: () => string } }

function toClient(record: StoredClient): Client {
  return {
    id: record._id.toString(),
    name: record.name,
    country: record.country,
    messageFormat: record.messageFormat,
    // Always the agreed number of slots, so a client saved before a change still lines up
    sampleMessages: Array.from({ length: SAMPLE_MESSAGE_COUNT }, (_, index) => record.sampleMessages[index] ?? ""),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

// Only the fields the client owns, each trimmed, with exactly SAMPLE_MESSAGE_COUNT samples
function cleanInput({ name, country, messageFormat, sampleMessages }: ClientInput) {
  return {
    name: name.replace(/\s+/g, " ").trim(),
    country: country.replace(/\s+/g, " ").trim(),
    messageFormat: messageFormat.trim(),
    sampleMessages: Array.from({ length: SAMPLE_MESSAGE_COUNT }, (_, index) => (sampleMessages[index] ?? "").trim()),
  }
}

export async function listClients(viewer: Viewer): Promise<Client[]> {
  await connectDatabase()
  const records = await ClientModel.find(visibleTo(viewer)).sort({ createdAt: 1 }).lean()
  return (records as unknown as StoredClient[]).map(toClient)
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
  const record = await ClientModel.create({ ownerId: viewer.id, ...cleanInput(input) })
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
  if (deletedCount > 0) await ClientProjectModel.deleteMany({ clientId: id })
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
