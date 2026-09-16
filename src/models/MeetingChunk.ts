import mongoose, { Schema, type Model } from "mongoose"

/**
 * What one chunk of one transcript gave up, saved as soon as it is read. Keeping chunk results
 * here rather than on the meeting means a run can stop at any point (a request ending, a provider
 * failing, the browser closing) and carry on later without reading the same chunk twice.
 */
export interface IMeetingChunk {
  meetingId: mongoose.Types.ObjectId
  // Position in the transcript, so the results go back together in the order they were said
  index: number
  // The transcript this chunk came from, so results from an older transcript are never reused
  transcriptHash: string
  result: unknown
  createdAt: Date
  updatedAt: Date
}

const MeetingChunkSchema = new Schema<IMeetingChunk>(
  {
    meetingId: { type: Schema.Types.ObjectId, required: true },
    index: { type: Number, required: true },
    transcriptHash: { type: String, required: true },
    result: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true, collection: "meeting_chunks" }
)
// One result per chunk of one transcript, so a repeated run cannot store the same chunk twice
MeetingChunkSchema.index({ meetingId: 1, transcriptHash: 1, index: 1 }, { unique: true })

export const MeetingChunk =
  (mongoose.models.MeetingChunk as Model<IMeetingChunk> | undefined) ??
  mongoose.model<IMeetingChunk>("MeetingChunk", MeetingChunkSchema)
