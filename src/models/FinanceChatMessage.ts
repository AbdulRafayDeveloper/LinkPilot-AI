import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"

/**
 * One message in a person's Finance Bot chat, kept so the conversation is still there next time and a
 * follow-up knows what was already asked. The chat is the person's own (`ownerId` is their account),
 * and an answer records which parts of their profile it was shaped by and which provider wrote it.
 */
export interface IFinanceChatMessage {
  ownerId: string | null
  role: "you" | "assistant"
  text: string
  // The sections of My AI Profile the answer was read from; empty when the profile held nothing on it
  sources: string[]
  fromProfile: boolean
  provider: string | null
  createdAt: Date
  updatedAt: Date
}

const FinanceChatMessageSchema = new Schema<IFinanceChatMessage>(
  {
    ownerId: OWNER_ID,
    role: { type: String, enum: ["you", "assistant"], required: true },
    text: { type: String, required: true },
    sources: { type: [String], default: [] },
    fromProfile: { type: Boolean, default: false },
    provider: { type: String, default: null },
  },
  { timestamps: true, collection: "finance_chat_messages" }
)
// One person's chat, oldest first, with _id breaking ties inside a millisecond
FinanceChatMessageSchema.index({ ownerId: 1, createdAt: 1, _id: 1 })

export const FinanceChatMessageModel =
  (mongoose.models.FinanceChatMessage as Model<IFinanceChatMessage> | undefined) ??
  mongoose.model<IFinanceChatMessage>("FinanceChatMessage", FinanceChatMessageSchema)
