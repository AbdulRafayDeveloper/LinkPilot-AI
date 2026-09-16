import mongoose, { Schema, type Model } from "mongoose"

/**
 * One saved piece of reference content: a named set of steps, an explanation, a procedure or any
 * other text worth sending again. The app has no accounts, so saved content belongs to whoever
 * opens it, exactly like Quick Notes and Daily Tasks.
 */
export interface IReferenceItem {
  title: string
  content: string
  createdAt: Date
  updatedAt: Date
}

const ReferenceItemSchema = new Schema<IReferenceItem>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
  },
  { timestamps: true, collection: "reference_content" }
)
// Newest first, with _id breaking ties so two items saved in the same millisecond keep a stable order
ReferenceItemSchema.index({ createdAt: -1, _id: -1 })

export const ReferenceItem =
  (mongoose.models.ReferenceItem as Model<IReferenceItem> | undefined) ??
  mongoose.model<IReferenceItem>("ReferenceItem", ReferenceItemSchema)
