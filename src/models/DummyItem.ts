import mongoose, { Schema, type Model } from "mongoose"

/**
 * One Dummy Data sample (profile, post, comment thread, conversation), identified within its
 * kind by `slug`, the id the API and popup use.
 */
export interface IDummyItem {
  kind: string
  slug: string
  name: string
  // One value per field of the kind (see DUMMY_DATA_KINDS), keyed by field key
  fields: Record<string, string>
  createdAt: Date
  updatedAt: Date
}

const DummyItemSchema = new Schema<IDummyItem>(
  {
    kind: { type: String, required: true },
    slug: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    fields: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true, collection: "dummy_data", minimize: false }
)
DummyItemSchema.index({ kind: 1, slug: 1 }, { unique: true })

export const DummyItem =
  (mongoose.models.DummyItem as Model<IDummyItem> | undefined) ?? mongoose.model<IDummyItem>("DummyItem", DummyItemSchema)
