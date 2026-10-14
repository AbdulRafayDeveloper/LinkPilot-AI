import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"

/**
 * A folder in Personal Drive (`asset_folders`): a name and the folder it sits in.
 *
 * It is nested, like a client project's folders and unlike Prompt Creator's and Important Content's
 * flat lists, because a drive is folders inside folders. Depth is capped (`DRIVE_FOLDER_MAX_DEPTH`)
 * so a tree stays something a person can read, and a name is unique **among its siblings** only, so
 * "Invoices" may exist in two different places the way it does on a computer.
 *
 * A folder holds nothing itself: a file carries the id of the folder it is in (`folderId` on
 * `important_files`, null at the top of the drive), so moving a file is one small write and
 * deleting a folder only frees what was in it, into the folder above.
 */
export interface IAssetFolder {
  // The account it belongs to (models/owner.ts); a child account shares its parent's drive
  ownerId: string | null
  name: string
  // The folder it sits in, null at the top of the drive
  parentId: string | null
  createdAt: Date
  updatedAt: Date
}

const AssetFolderSchema = new Schema<IAssetFolder>(
  {
    ownerId: OWNER_ID,
    name: { type: String, required: true, trim: true },
    parentId: { type: String, default: null },
  },
  { timestamps: true, collection: "asset_folders" }
)
// One account's tree, read by name, which is the order the folders are shown in
AssetFolderSchema.index({ ownerId: 1, name: 1 })
// The folders inside one, for the tree and for freeing them when it is deleted
AssetFolderSchema.index({ ownerId: 1, parentId: 1 })

export const AssetFolder =
  (mongoose.models.AssetFolder as Model<IAssetFolder> | undefined) ?? mongoose.model<IAssetFolder>("AssetFolder", AssetFolderSchema)
