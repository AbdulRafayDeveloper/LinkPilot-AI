import { connectDatabase } from "@/lib/db"
import { MeetingChatMessageModel, type IMeetingChatMessage } from "@/models/MeetingChatMessage"
import { MeetingVectorModel } from "@/models/MeetingVector"
import { CHAT_HISTORY_LIMIT } from "@/constants/meetingChat"
import type { MeetingChatHistory, MeetingChatMessage } from "@/types/meetingChat"

/**
 * One meeting's chat, kept so it is still there when the page is opened again and so a follow-up
 * question knows what was already asked. The meeting is checked before any of this is called (the
 * route reads it with the viewer), so these work from the meeting's id.
 */

type Stored = IMeetingChatMessage & { _id: { toString: () => string } }

const toMessage = (record: Stored): MeetingChatMessage => ({
  id: record._id.toString(),
  role: record.role,
  text: record.text,
  sources: record.sources ?? [],
  fromMeeting: Boolean(record.fromMeeting),
  provider: record.provider ?? null,
  createdAt: new Date(record.createdAt).toISOString(),
})

/** The chat so far, oldest first, with how many pieces of the meeting can be searched. */
export async function getMeetingChat(meetingId: string): Promise<MeetingChatHistory> {
  await connectDatabase()
  const [records, pieces] = await Promise.all([
    MeetingChatMessageModel.find({ meetingId }).sort({ createdAt: 1, _id: 1 }).limit(CHAT_HISTORY_LIMIT).lean() as Promise<Stored[]>,
    MeetingVectorModel.countDocuments({ meetingId }),
  ])
  return { messages: records.map(toMessage), pieces }
}

export async function saveChatMessage(
  meetingId: string,
  ownerId: string | null,
  message: Pick<MeetingChatMessage, "role" | "text"> & Partial<Pick<MeetingChatMessage, "sources" | "fromMeeting" | "provider">>
): Promise<MeetingChatMessage> {
  await connectDatabase()
  const record = (await MeetingChatMessageModel.create({
    meetingId,
    ownerId,
    role: message.role,
    text: message.text,
    sources: message.sources ?? [],
    fromMeeting: message.fromMeeting ?? false,
    provider: message.provider ?? null,
  })) as unknown as Stored
  return toMessage(record)
}

/** Clears one meeting's chat. The meeting, its preparation and its vectors are untouched. */
export async function clearMeetingChat(meetingId: string): Promise<void> {
  await connectDatabase()
  await MeetingChatMessageModel.deleteMany({ meetingId })
}
