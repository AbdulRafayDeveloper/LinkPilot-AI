import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"

/**
 * A piece of text the user saved to reuse later. Nothing is generated or rewritten here, so a
 * note is its content (formatted text, the Markdown subset of lib/richText.ts, which may name
 * images stored for it), an optional title, and when it was saved and last changed.
 */
export interface IQuickNote {
  // The account it belongs to (models/owner.ts)
  ownerId: string | null
  // Optional; "" for a note saved without one, and for every note saved before titles existed
  title: string
  content: string
  createdAt: Date
  updatedAt: Date
}

const QuickNoteSchema = new Schema<IQuickNote>(
  {
    ownerId: OWNER_ID,
    title: { type: String, default: "" },
    content: { type: String, required: true },
  },
  { timestamps: true, collection: "quick_notes" }
)
// Newest first, with _id breaking ties so two notes saved in the same millisecond keep a stable order
QuickNoteSchema.index({ createdAt: -1, _id: -1 })

export const QuickNote =
  (mongoose.models.QuickNote as Model<IQuickNote> | undefined) ?? mongoose.model<IQuickNote>("QuickNote", QuickNoteSchema)
