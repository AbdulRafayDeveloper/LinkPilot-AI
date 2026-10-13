import mongoose, { Schema, type Model } from "mongoose"
import type { ProjectItemKind } from "@/constants/clientProjectTasks"
import { OWNER_ID } from "./owner"

/**
 * A folder the documents and links of one project are filed in (`client_project_folders`).
 *
 * It is the app's **only nested** folder collection: Prompt Creator's and Important Content's
 * folders are one flat list each, while a project's documents are filed the way files are, so a
 * folder may sit inside another (`parentId`, null at the top). Depth is capped
 * (`PROJECT_FOLDER_MAX_DEPTH`) so a tree stays something a person can read.
 *
 * A folder holds nothing itself: an item carries the id of the folder it is in (`folderId` on
 * `client_project_tasks`, null for one at the top), so moving an item is one small write and
 * deleting a folder only frees what was in it, into the folder above.
 *
 * It belongs to **one project and one tab** (`projectId` and `kind`): the Documents tab's folders
 * are not the Links tab's, which is what keeps each tab's tree about its own work.
 */
export interface IClientProjectFolder {
  // The account it belongs to (models/owner.ts); always the project's own owner
  ownerId: string | null
  // The project whose items it files
  projectId: string
  // Which tab's items it files, so a tab only ever shows its own folders
  kind: ProjectItemKind
  name: string
  // The folder it sits in, null at the top of the tree
  parentId: string | null
  createdAt: Date
  updatedAt: Date
}

const ClientProjectFolderSchema = new Schema<IClientProjectFolder>(
  {
    ownerId: OWNER_ID,
    projectId: { type: String, required: true },
    // Checked against the kinds that have folders by the route before it is ever written
    kind: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    parentId: { type: String, default: null },
  },
  { timestamps: true, collection: "client_project_folders" }
)
// Every read is one project's one tab, by name
ClientProjectFolderSchema.index({ projectId: 1, kind: 1, name: 1 })
// The children of one folder, for the tree and for freeing them when it is deleted
ClientProjectFolderSchema.index({ projectId: 1, parentId: 1 })

export const ClientProjectFolderModel =
  (mongoose.models.ClientProjectFolder as Model<IClientProjectFolder> | undefined) ??
  mongoose.model<IClientProjectFolder>("ClientProjectFolder", ClientProjectFolderSchema)
