import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"
import { PROJECT_TASK_STATUS_IDS } from "@/constants/clientProjectTasks"

/**
 * One task on a client project. It carries its line, an optional description (the Markdown subset
 * of `lib/richText.ts`), any images and one voice note, all stored in S3 and named here by the id
 * the server made for them. The project and the client are both on the task, so a task can be read
 * back to its client without a second lookup, and a project a viewer may not see can never be
 * reached through its tasks.
 */
export interface IClientProjectTask {
  // The account it belongs to (models/owner.ts)
  ownerId: string | null
  clientId: string
  projectId: string
  content: string
  description: string
  images: { assetId: string; contentType: string }[]
  voiceNote: { assetId: string; contentType: string; seconds: number } | null
  status: string
  // Where it sits in its project's list; a new task goes to the end
  position: number
  createdAt: Date
  updatedAt: Date
}

const ImageSchema = new Schema<IClientProjectTask["images"][number]>(
  { assetId: { type: String, required: true }, contentType: { type: String, required: true } },
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
    voiceNote: { type: VoiceNoteSchema, default: null },
    status: { type: String, enum: PROJECT_TASK_STATUS_IDS, default: "open" },
    position: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "client_project_tasks" }
)
// One project's tasks in the order they are shown, which is also how the public link reads them
ClientProjectTaskSchema.index({ projectId: 1, position: 1, createdAt: 1, _id: 1 })
// How many tasks each project has, for the list of projects
ClientProjectTaskSchema.index({ ownerId: 1, projectId: 1, status: 1 })

export const ClientProjectTaskModel =
  (mongoose.models.ClientProjectTask as Model<IClientProjectTask> | undefined) ??
  mongoose.model<IClientProjectTask>("ClientProjectTask", ClientProjectTaskSchema)
