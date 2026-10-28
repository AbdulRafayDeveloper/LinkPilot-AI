import { connectDatabase } from "@/lib/db"
import { FinanceChatMessageModel, type IFinanceChatMessage } from "@/models/FinanceChatMessage"
import { ProfileVectorModel } from "@/models/ProfileVector"
import { FINANCE_CHAT_HISTORY_LIMIT } from "@/constants/financeBot"
import type { FinanceChatHistory, FinanceChatMessage } from "@/types/financeBot"

/**
 * One person's Finance Bot chat, kept so it is still there when the page is opened again and so a
 * follow-up knows what was already asked. Every call is scoped to the account asking (`ownerId` is
 * `viewer.id`): the chat is the person's own, and an admin reads only their own chat here too.
 */

type Stored = IFinanceChatMessage & { _id: { toString: () => string } }

const toMessage = (record: Stored): FinanceChatMessage => ({
  id: record._id.toString(),
  role: record.role,
  text: record.text,
  sources: record.sources ?? [],
  fromProfile: Boolean(record.fromProfile),
  provider: record.provider ?? null,
  createdAt: new Date(record.createdAt).toISOString(),
})

/** The latest of the chat, oldest first, and whether the person's profile has anything to read. */
export async function getFinanceChat(ownerId: string): Promise<FinanceChatHistory> {
  await connectDatabase()
  const [records, profile] = await Promise.all([
    FinanceChatMessageModel.find({ ownerId }).sort({ createdAt: -1, _id: -1 }).limit(FINANCE_CHAT_HISTORY_LIMIT).lean() as Promise<Stored[]>,
    ProfileVectorModel.exists({ ownerId }),
  ])
  return { messages: records.reverse().map(toMessage), hasProfile: Boolean(profile) }
}

export async function saveFinanceMessage(
  ownerId: string,
  message: Pick<FinanceChatMessage, "role" | "text"> & Partial<Pick<FinanceChatMessage, "sources" | "fromProfile" | "provider">>
): Promise<FinanceChatMessage> {
  await connectDatabase()
  const record = (await FinanceChatMessageModel.create({
    ownerId,
    role: message.role,
    text: message.text,
    sources: message.sources ?? [],
    fromProfile: message.fromProfile ?? false,
    provider: message.provider ?? null,
  })) as unknown as Stored
  return toMessage(record)
}

/** Clears the person's chat. Their My AI Profile and its vectors are untouched. */
export async function clearFinanceChat(ownerId: string): Promise<void> {
  await connectDatabase()
  await FinanceChatMessageModel.deleteMany({ ownerId })
}
