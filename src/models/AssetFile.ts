import mongoose, { Schema, type Model } from "mongoose"

/**
 * One file kept in Important Files: what the user called it, what it is, and where it sits in
 * S3. The app has no accounts, so a saved file belongs to whoever opens it, exactly like Quick
 * Notes, Daily Tasks and Reference Content.
 *
 * `status` is what keeps the list honest. A record is written before the browser starts sending
 * the bytes, and only becomes "ready" once S3 confirms the finished object, so an upload that
 * was interrupted can never show up as a file you can open.
 */
export interface IAssetFile {
  name: string
  description: string
  originalName: string
  contentType: string
  category: string
  size: number
  // The object's key in the bucket, built on the server and never accepted from the browser
  storageKey: string
  // The multipart upload in progress, kept so an abandoned one can be aborted
  uploadId: string | null
  status: "uploading" | "ready"
  createdAt: Date
  updatedAt: Date
}

const AssetFileSchema = new Schema<IAssetFile>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    originalName: { type: String, required: true },
    contentType: { type: String, required: true },
    category: { type: String, required: true, index: true },
    size: { type: Number, required: true },
    storageKey: { type: String, required: true, unique: true },
    uploadId: { type: String, default: null },
    status: { type: String, enum: ["uploading", "ready"], required: true, default: "uploading" },
  },
  { timestamps: true, collection: "important_files" }
)
// Newest first, with _id breaking ties so two files saved in the same millisecond keep a stable order
AssetFileSchema.index({ status: 1, createdAt: -1, _id: -1 })
// Searching by name, inside a category, on the same index
AssetFileSchema.index({ status: 1, category: 1, createdAt: -1, _id: -1 })

export const AssetFile =
  (mongoose.models.AssetFile as Model<IAssetFile> | undefined) ?? mongoose.model<IAssetFile>("AssetFile", AssetFileSchema)
