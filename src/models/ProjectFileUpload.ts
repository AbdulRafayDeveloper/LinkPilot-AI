import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"
import { ASSET_CATEGORY_IDS } from "@/constants/importantFiles"
import { PROJECT_FILE_UPLOAD_HOURS } from "@/constants/clientProjectTasks"

/**
 * One file being sent up to a client project, while it is still arriving.
 *
 * A file goes in 4 MB chunks through the app and the server joins them, so something has to hold
 * what the file is, which chunks have landed and how far the joining has got, between one request
 * and the next. That is this: a short-lived record, not a record of an attachment. The finished file
 * is named on the item itself (`client_project_tasks.files`), and this row's only job is over once
 * the join finishes.
 *
 * It is scoped by the project, not by an account, because the shared link's uploads have no
 * account: the route proves which project it may touch (a signed token, or `visibleById` for a
 * signed-in page) and then everything here is held to that `projectId`.
 */
export interface IProjectFileUpload {
  // The account that owns the project, so an admin's lists and an account delete can find it
  ownerId: string | null
  projectId: string
  // The id the chunks and the finished object are keyed by; the browser never chooses a key
  assetId: string
  name: string
  contentType: string
  category: string
  size: number
  chunkBytes: number
  chunkCount: number
  // Which chunks have landed and how big each was, by index: `{ "0": 4194304, "1": 1048576 }`
  chunks: Record<string, number>
  // The joining, once it starts: S3's upload id, the part to send next, and the finished object
  uploadId: string | null
  nextPart: number
  finalKey: string | null
  createdAt: Date
  updatedAt: Date
}

const ProjectFileUploadSchema = new Schema<IProjectFileUpload>(
  {
    ownerId: OWNER_ID,
    projectId: { type: String, required: true, index: true },
    assetId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    contentType: { type: String, required: true },
    category: { type: String, required: true, enum: ASSET_CATEGORY_IDS },
    size: { type: Number, required: true },
    chunkBytes: { type: Number, required: true },
    chunkCount: { type: Number, required: true },
    chunks: { type: Schema.Types.Mixed, default: {} },
    uploadId: { type: String, default: null },
    nextPart: { type: Number, default: 1 },
    finalKey: { type: String, default: null },
  },
  { timestamps: true, collection: "project_file_uploads" }
)
// An upload nobody finished is forgotten by itself, so a dropped browser leaves no row behind. Its
// chunks are cleaned up with the project or the account; they are named by this row until then.
ProjectFileUploadSchema.index({ updatedAt: 1 }, { expireAfterSeconds: PROJECT_FILE_UPLOAD_HOURS * 60 * 60 })

export const ProjectFileUploadModel =
  (mongoose.models.ProjectFileUpload as Model<IProjectFileUpload> | undefined) ??
  mongoose.model<IProjectFileUpload>("ProjectFileUpload", ProjectFileUploadSchema)
