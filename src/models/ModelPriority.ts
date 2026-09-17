import mongoose, { Schema, type Model } from "mongoose"

/**
 * The provider order an admin chose for one module (AI Model Priority). A module with no document
 * uses the default order (Groq first), and a regular user always does. It belongs to no account: it is
 * the admins' setting, and records who changed it last.
 */
export interface IModelPriority {
  module: string
  order: string[]
  updatedBy: string
  createdAt: Date
  updatedAt: Date
}

const ModelPrioritySchema = new Schema<IModelPriority>(
  {
    module: { type: String, required: true, unique: true },
    order: { type: [String], required: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true, collection: "model_priorities" }
)

export const ModelPriority =
  (mongoose.models.ModelPriority as Model<IModelPriority> | undefined) ?? mongoose.model<IModelPriority>("ModelPriority", ModelPrioritySchema)
