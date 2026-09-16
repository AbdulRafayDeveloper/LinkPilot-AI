import mongoose, { Schema, type Model } from "mongoose"

/**
 * The text a prompt had before each save, so an overwritten prompt can always be recovered.
 */
export interface IPromptRevision {
  promptKey: string
  content: string
  createdAt: Date
  updatedAt: Date
}

const PromptRevisionSchema = new Schema<IPromptRevision>(
  {
    promptKey: { type: String, required: true },
    content: { type: String, required: true },
  },
  { timestamps: true, collection: "prompt_revisions" }
)
PromptRevisionSchema.index({ promptKey: 1, createdAt: -1 })

export const PromptRevision =
  (mongoose.models.PromptRevision as Model<IPromptRevision> | undefined) ??
  mongoose.model<IPromptRevision>("PromptRevision", PromptRevisionSchema)
