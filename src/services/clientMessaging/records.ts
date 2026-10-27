import { connectDatabase } from "@/lib/db"
import { ClientMessageRecord } from "@/models/GenerationRecords"
import type { Client, GeneratedClientMessage } from "@/types/clientMessaging"
import type { Viewer } from "@/types/auth"

/**
 * Saves the written message with the client it went to and what it was written from. Like
 * Prompt Creator, the record is part of the result: the page shows it as saved.
 */
export async function saveClientMessage(
  viewer: Viewer,
  client: Client,
  update: string,
  result: Omit<GeneratedClientMessage, "id">
): Promise<GeneratedClientMessage> {
  await connectDatabase()
  const record = await ClientMessageRecord.create({
    ownerId: viewer.id,
    client: { id: client.id, name: client.name, country: client.country },
    channel: result.channel,
    update,
    subject: result.subject,
    message: result.message,
    characterCount: result.characterCount,
    result,
  })
  return { ...result, id: String(record._id) }
}
