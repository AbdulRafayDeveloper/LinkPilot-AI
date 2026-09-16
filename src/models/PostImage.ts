import mongoose, { Schema, type Model } from "mongoose"

/**
 * The brand defaults, and every post image made from them.
 *
 * The app has no accounts, so both belong to whoever opens the app, exactly like Quick Notes,
 * Important Files and the rest. The defaults are one document; the images are one document each.
 */

/** One reusable photo in the defaults. The object itself lives in S3 under its key. */
export interface IBrandAsset {
  id: string
  name: string
  storageKey: string
  contentType: string
  size: number
  createdAt: Date
}

export interface IBrandSettings {
  // One row for the whole app, found by this key rather than by an account
  scope: string
  displayName: string
  colors: string[]
  assets: IBrandAsset[]
  createdAt: Date
  updatedAt: Date
}

const BrandAssetSchema = new Schema<IBrandAsset>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    storageKey: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const BrandSettingsSchema = new Schema<IBrandSettings>(
  {
    scope: { type: String, required: true, unique: true, default: "default" },
    displayName: { type: String, default: "" },
    colors: { type: [String], default: [] },
    assets: { type: [BrandAssetSchema], default: [] },
  },
  { timestamps: true, collection: "post_image_settings" }
)

export const BrandSettingsModel =
  (mongoose.models.BrandSettings as Model<IBrandSettings> | undefined) ??
  mongoose.model<IBrandSettings>("BrandSettings", BrandSettingsSchema)

/**
 * One generated image. Everything about how it was made is copied in here at the time, so the
 * record still describes it after the defaults, the prompt or the model have moved on.
 */
export interface IPostImage {
  storageKey: string
  contentType: string
  size: number
  width: number
  height: number
  postContent: string
  // The settings as they were when this image was drawn, not a pointer at today's defaults
  displayName: string
  colors: string[]
  assetName: string | null
  assetStorageKey: string | null
  pose: string | null
  sizeId: string
  model: string
  // The instructions actually sent to the image model, kept word for word
  prompt: string
  createdAt: Date
  updatedAt: Date
}

const PostImageSchema = new Schema<IPostImage>(
  {
    storageKey: { type: String, required: true, unique: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    postContent: { type: String, required: true },
    displayName: { type: String, default: "" },
    colors: { type: [String], default: [] },
    assetName: { type: String, default: null },
    assetStorageKey: { type: String, default: null },
    pose: { type: String, default: null },
    sizeId: { type: String, required: true },
    model: { type: String, required: true },
    prompt: { type: String, required: true },
  },
  { timestamps: true, collection: "post_images" }
)
// Newest first, with _id breaking ties so two images made in the same millisecond keep an order
PostImageSchema.index({ createdAt: -1, _id: -1 })

export const PostImageModel =
  (mongoose.models.PostImage as Model<IPostImage> | undefined) ?? mongoose.model<IPostImage>("PostImage", PostImageSchema)
