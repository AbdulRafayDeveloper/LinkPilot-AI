import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"

/**
 * A project the Prompt Creator writes prompts for: a name and the standing instructions every
 * prompt created in it ends with. A prompt points at its project through `projectId` on the prompt
 * itself, so deleting a project never deletes a prompt.
 */
export interface IPromptProject {
  // The account it belongs to (models/owner.ts)
  ownerId: string | null
  name: string
  instructions: string
  createdAt: Date
  updatedAt: Date
}

const PromptProjectSchema = new Schema<IPromptProject>(
  {
    ownerId: OWNER_ID,
    name: { type: String, required: true, trim: true },
    instructions: { type: String, default: "" },
  },
  { timestamps: true, collection: "prompt_projects" }
)
// The picker and the manager list an account's projects by name
PromptProjectSchema.index({ ownerId: 1, name: 1 })

export const PromptProjectModel =
  (mongoose.models.PromptProject as Model<IPromptProject> | undefined) ?? mongoose.model<IPromptProject>("PromptProject", PromptProjectSchema)
