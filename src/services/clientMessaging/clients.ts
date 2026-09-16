import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { Client as ClientModel, type IClient } from "@/models/Client"
import { CLIENT_MESSAGING_MESSAGES, SAMPLE_MESSAGE_COUNT } from "@/constants/clientMessaging"
import type { Client, ClientInput } from "@/types/clientMessaging"

/**
 * The clients the user writes to, kept in the clients collection. Each one carries its own
 * message format and sample messages, which is what the generated message follows.
 */
const ID_PATTERN = /^[0-9a-f]{24}$/

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

export async function listClients(): Promise<Client[]> {
  await connectDatabase()
  const records = await ClientModel.find({}).sort({ createdAt: 1 }).lean()
  return (records as unknown as StoredClient[]).map(toClient)
}

export async function getClient(id: string): Promise<Client | null> {
  if (!ID_PATTERN.test(id)) return null
  await connectDatabase()
  const record = await ClientModel.findById(id).lean()
  return record ? toClient(record as unknown as StoredClient) : null
}

export async function createClient(input: ClientInput): Promise<Client> {
  await connectDatabase()
  const record = await ClientModel.create(cleanInput(input))
  return toClient(record as unknown as StoredClient)
}

/**
 * Replaces a client's details. Returns null when the client no longer exists.
 */
export async function updateClient(id: string, input: ClientInput): Promise<Client | null> {
  if (!ID_PATTERN.test(id)) return null
  await connectDatabase()
  const record = await ClientModel.findByIdAndUpdate(id, cleanInput(input), {
    returnDocument: "after",
    runValidators: true,
  }).lean()
  return record ? toClient(record as unknown as StoredClient) : null
}

export async function deleteClient(id: string): Promise<boolean> {
  if (!ID_PATTERN.test(id)) return false
  await connectDatabase()
  const { deletedCount } = await ClientModel.deleteOne({ _id: id })
  return deletedCount > 0
}

/**
 * The client a message is being written for. Throws a message the user can act on when the
 * client was removed in another window.
 */
export async function requireClient(id: string): Promise<Client> {
  const client = await getClient(id)
  if (!client) throw new UserFacingError(CLIENT_MESSAGING_MESSAGES.clientNotFound)
  return client
}
