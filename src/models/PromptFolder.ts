import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"

/**
 * A folder the user keeps created prompts in. Only a name: a prompt points at its folder through
 * `folderId` on the prompt itself, so deleting a folder never deletes a prompt.
 */
export interface IPromptFolder {
  // The account it belongs to (models/owner.ts)
  ownerId: string | null
  name: string
  createdAt: Date
  updatedAt: Date
}

const PromptFolderSchema = new Schema<IPromptFolder>(
  {
    ownerId: OWNER_ID,
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true, collection: "prompt_folders" }
)
// The picker and the filter list an account's folders by name
PromptFolderSchema.index({ ownerId: 1, name: 1 })

export const PromptFolderModel =
  (mongoose.models.PromptFolder as Model<IPromptFolder> | undefined) ?? mongoose.model<IPromptFolder>("PromptFolder", PromptFolderSchema)
