import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"

/**
 * One piece of one meeting, with the vector that stands for its meaning. This is the meeting's own
 * little vector database: a question is turned into a vector too, and the closest pieces are what
 * the chat answers from ($vectorSearch on `embedding`, filtered to the meeting and its account).
 * `sourceHash` is the fingerprint of everything the meeting held when these pieces were written, so
 * a meeting whose preparation or notes changed is recognised and written again.
 */
export interface IMeetingVector {
  ownerId: string | null
  meetingId: string
  // Where the piece came from (constants/meetingChat.ts MEETING_CHUNK_KINDS)
  kind: string
  // What to call it in an answer ("Stage 2. Understanding their situation")
  label: string
  text: string
  embedding: number[]
  // The embedding model that wrote the vector, so a change of model is a change of fingerprint
  model: string
  sourceHash: string
  createdAt: Date
  updatedAt: Date
}

const MeetingVectorSchema = new Schema<IMeetingVector>(
  {
    ownerId: OWNER_ID,
    meetingId: { type: String, required: true },
    kind: { type: String, required: true },
    label: { type: String, default: "" },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
    model: { type: String, required: true },
    sourceHash: { type: String, required: true },
  },
  { timestamps: true, collection: "meeting_vectors" }
)
// Everything is read, replaced and deleted one meeting at a time
MeetingVectorSchema.index({ meetingId: 1, sourceHash: 1 })

export const MeetingVectorModel =
  (mongoose.models.MeetingVector as Model<IMeetingVector> | undefined) ?? mongoose.model<IMeetingVector>("MeetingVector", MeetingVectorSchema)
