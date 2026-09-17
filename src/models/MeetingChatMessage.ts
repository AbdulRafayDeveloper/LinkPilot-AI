import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"

/**
 * One message in a meeting's chat, kept so the conversation is still there when the page is opened
 * again and so a follow-up question knows what was already asked. An answer also records which
 * pieces of the meeting it was read from and which provider wrote it.
 */
export interface IMeetingChatMessage {
  ownerId: string | null
  meetingId: string
  role: "you" | "assistant"
  text: string
  // What the answer was read from, by label; empty when it came from general knowledge
  sources: string[]
  // False when the meeting held no answer and the model explained the subject instead
  fromMeeting: boolean
  provider: string | null
  createdAt: Date
  updatedAt: Date
}

const MeetingChatMessageSchema = new Schema<IMeetingChatMessage>(
  {
    ownerId: OWNER_ID,
    meetingId: { type: String, required: true },
    role: { type: String, enum: ["you", "assistant"], required: true },
    text: { type: String, required: true },
    sources: { type: [String], default: [] },
    fromMeeting: { type: Boolean, default: false },
    provider: { type: String, default: null },
  },
  { timestamps: true, collection: "meeting_chat_messages" }
)
// One meeting's chat, oldest first, with _id breaking ties inside a millisecond
MeetingChatMessageSchema.index({ meetingId: 1, createdAt: 1, _id: 1 })

export const MeetingChatMessageModel =
  (mongoose.models.MeetingChatMessage as Model<IMeetingChatMessage> | undefined) ??
  mongoose.model<IMeetingChatMessage>("MeetingChatMessage", MeetingChatMessageSchema)
