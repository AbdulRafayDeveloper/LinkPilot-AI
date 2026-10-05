import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"
import { DEFAULT_PROJECT_ITEM_KIND, PROJECT_ITEM_AUTHORS, PROJECT_ITEM_KIND_IDS, PROJECT_TASK_STATUS_IDS } from "@/constants/clientProjectTasks"

/**
 * One item on a client project: a change, an idea or something in the discussion, which is what
 * `kind` says. It carries its line, an optional description (the Markdown subset of
 * `lib/richText.ts`), any images and one voice note, all stored in S3 and named here by the id the
 * server made for them. The project and the client are both on the item, so it can be read back to
 * its client without a second lookup, and a project a viewer may not see can never be reached
 * through its items.
 *
 * `kind` defaults to the first tab and `addedBy` to the owner, so every row written before the tabs
 * and the writable shared link existed reads exactly as it did: a change, added by the owner.
 */
export interface IClientProjectTask {
  // The account it belongs to (models/owner.ts). An item added from the shared link is stored
  // against the project's owner, since that is whose project and whose list it is.
  ownerId: string | null
  clientId: string
  projectId: string
  content: string
  description: string
  images: { assetId: string; contentType: string }[]
  // Word, PDF, video, anything the app can place (services/clientProjects/files.ts)
  files: { assetId: string; name: string; contentType: string; category: string; size: number }[]
  voiceNote: { assetId: string; contentType: string; seconds: number } | null
  status: string
  // Which tab it sits under: change, idea or discussion
  kind: string
  // Whether the owner added it or someone writing from the shared link did
  addedBy: string
  // Where it sits in its tab's list; a new item goes to the end
  position: number
  createdAt: Date
  updatedAt: Date
}

const ImageSchema = new Schema<IClientProjectTask["images"][number]>(
  { assetId: { type: String, required: true }, contentType: { type: String, required: true } },
  { _id: false }
)

const FileSchema = new Schema<IClientProjectTask["files"][number]>(
  {
    assetId: { type: String, required: true },
    name: { type: String, required: true },
    contentType: { type: String, required: true },
    category: { type: String, required: true },
    size: { type: Number, default: 0 },
  },
  { _id: false }
)

const VoiceNoteSchema = new Schema<NonNullable<IClientProjectTask["voiceNote"]>>(
  { assetId: { type: String, required: true }, contentType: { type: String, required: true }, seconds: { type: Number, default: 0 } },
  { _id: false }
)

const ClientProjectTaskSchema = new Schema<IClientProjectTask>(
  {
    ownerId: OWNER_ID,
    clientId: { type: String, required: true, index: true },
    projectId: { type: String, required: true, index: true },
    content: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    images: { type: [ImageSchema], default: [] },
    files: { type: [FileSchema], default: [] },
    voiceNote: { type: VoiceNoteSchema, default: null },
    status: { type: String, enum: PROJECT_TASK_STATUS_IDS, default: "open" },
    kind: { type: String, enum: PROJECT_ITEM_KIND_IDS, default: DEFAULT_PROJECT_ITEM_KIND },
    addedBy: { type: String, enum: PROJECT_ITEM_AUTHORS, default: "owner" },
    position: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "client_project_tasks" }
)
// One tab of one project, in the order it is shown, which is how both surfaces read it
ClientProjectTaskSchema.index({ projectId: 1, kind: 1, position: 1, createdAt: 1, _id: 1 })
// How each tab of each project stands, for the list of projects (one grouped query for them all)
ClientProjectTaskSchema.index({ ownerId: 1, projectId: 1, kind: 1, status: 1 })

export const ClientProjectTaskModel =
  (mongoose.models.ClientProjectTask as Model<IClientProjectTask> | undefined) ??
  mongoose.model<IClientProjectTask>("ClientProjectTask", ClientProjectTaskSchema)
