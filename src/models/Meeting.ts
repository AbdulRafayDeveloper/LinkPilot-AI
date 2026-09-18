import mongoose, { Schema, type Model } from "mongoose"
import { MEETING_STATUS_IDS } from "@/constants/meetings"
import { OWNER_ID } from "./owner"

/**
 * One meeting: the transcript exactly as it was pasted, and the analysis built from it. The two
 * are kept apart on purpose, so a failed or re-run analysis can never cost the source content.
 * The app has no accounts, so meetings belong to whoever opens it, like the other saved modules.
 */
export interface IMeeting {
  // The account it belongs to (models/owner.ts)
  ownerId: string | null
  title: string
  isTitleGenerated: boolean
  transcript: string
  transcriptChars: number
  // Fingerprint of the transcript the current analysis was built from; a different transcript
  // means the analysis is out of date
  transcriptHash: string
  analyzedHash: string | null
  status: (typeof MEETING_STATUS_IDS)[number]
  statusMessage: string | null
  totalChunks: number
  analyzedChunks: number
  analysis: unknown
  analyzedAt: Date | null
  // Who wrote the analysis: the last provider that answered and every provider that did, over all its calls
  analysisProvider: string | null
  analysisProviders: string[]
  // The notes built from the analysis, which the user can edit (lib/meetingNotes.ts); "" until the first analysis
  notes: string
  // When the user last changed the notes by hand; while set, a new analysis leaves them alone
  notesEditedAt: Date | null
  // A meeting recorded in the app (types/meetingRecording.ts StoredRecording); null for a pasted one
  recording: unknown
  createdAt: Date
  updatedAt: Date
}

const MeetingSchema = new Schema<IMeeting>(
  {
    ownerId: OWNER_ID,
    title: { type: String, required: true, trim: true },
    isTitleGenerated: { type: Boolean, required: true, default: false },
    // Empty only while a recorded meeting is still being written out; a pasted one is refused empty by its route
    transcript: { type: String, default: "" },
    transcriptChars: { type: Number, default: 0 },
    transcriptHash: { type: String, default: "" },
    analyzedHash: { type: String, default: null },
    status: { type: String, enum: MEETING_STATUS_IDS, required: true, default: "saved" },
    statusMessage: { type: String, default: null },
    totalChunks: { type: Number, required: true, default: 0 },
    analyzedChunks: { type: Number, required: true, default: 0 },
    // The whole MeetingAnalysis, validated against its schema before it is written
    analysis: { type: Schema.Types.Mixed, default: null },
    analyzedAt: { type: Date, default: null },
    analysisProvider: { type: String, default: null },
    analysisProviders: { type: [String], default: [] },
    notes: { type: String, default: "" },
    notesEditedAt: { type: Date, default: null },
    // Mixed on purpose: chunks are confirmed one key at a time with a $set on their own path
    recording: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true, collection: "meetings" }
)
// The history list: newest first, with _id breaking ties
MeetingSchema.index({ createdAt: -1, _id: -1 })
// Filtering the list by status, still newest first
MeetingSchema.index({ status: 1, createdAt: -1, _id: -1 })
// Searching by name, which is the only field the search matches
MeetingSchema.index({ title: 1 })

export const Meeting = (mongoose.models.Meeting as Model<IMeeting> | undefined) ?? mongoose.model<IMeeting>("Meeting", MeetingSchema)
