import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"

/**
 * A piece of text the user saved to reuse later. Nothing is generated or rewritten here, so a
 * note is just its content and when it was saved.
 */
export interface IQuickNote {
  // The account it belongs to (models/owner.ts)
  ownerId: string | null
  content: string
  createdAt: Date
  updatedAt: Date
}

const QuickNoteSchema = new Schema<IQuickNote>(
  {
    ownerId: OWNER_ID,
    content: { type: String, required: true },
  },
  { timestamps: true, collection: "quick_notes" }
)
// Newest first, with _id breaking ties so two notes saved in the same millisecond keep a stable order
QuickNoteSchema.index({ createdAt: -1, _id: -1 })

export const QuickNote =
  (mongoose.models.QuickNote as Model<IQuickNote> | undefined) ?? mongoose.model<IQuickNote>("QuickNote", QuickNoteSchema)
