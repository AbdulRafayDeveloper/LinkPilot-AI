import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"

/**
 * A folder the user files Important Content entries in. Only a name: an entry points at its folder
 * through `folderId` on the entry itself (`models/ImportantContent.ts`), so deleting a folder never
 * deletes an entry. Its own collection, never Prompt Creator's `prompt_folders`.
 */
export interface IContentFolder {
  // The account it belongs to (models/owner.ts)
  ownerId: string | null
  name: string
  createdAt: Date
  updatedAt: Date
}

const ContentFolderSchema = new Schema<IContentFolder>(
  {
    ownerId: OWNER_ID,
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true, collection: "content_folders" }
)
// The picker and the filter list an account's folders by name
ContentFolderSchema.index({ ownerId: 1, name: 1 })

export const ContentFolderModel =
  (mongoose.models.ContentFolder as Model<IContentFolder> | undefined) ?? mongoose.model<IContentFolder>("ContentFolder", ContentFolderSchema)
