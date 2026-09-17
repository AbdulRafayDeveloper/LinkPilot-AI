import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"

/**
 * One saved piece of important content: a name, an optional description (the text itself) and a
 * type the user typed, kept as written. The type list offered in the filter is read from these.
 */
export interface IImportantContent {
  // The account it belongs to (models/owner.ts)
  ownerId: string | null
  name: string
  description: string
  type: string
  createdAt: Date
  updatedAt: Date
}

const ImportantContentSchema = new Schema<IImportantContent>(
  {
    ownerId: OWNER_ID,
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    type: { type: String, required: true, trim: true },
  },
  { timestamps: true, collection: "important_content" }
)
// Newest first with a stable tie-break for the pages, and one account's entries of one type for the filter
ImportantContentSchema.index({ createdAt: -1, _id: -1 })
ImportantContentSchema.index({ ownerId: 1, type: 1 })

export const ImportantContentModel =
  (mongoose.models.ImportantContent as Model<IImportantContent> | undefined) ??
  mongoose.model<IImportantContent>("ImportantContent", ImportantContentSchema)
