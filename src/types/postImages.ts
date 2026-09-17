import type { AssetPoseId, ImageSizeId } from "@/constants/postImages"
import type { EditablePrompt } from "./prompts"
import type { WithAiSource } from "./ai"

/** One reusable photo kept in the brand defaults. The key stays on the server. */
export interface BrandAsset {
  id: string
  name: string
  contentType: string
  size: number
  // A signed link for showing it in the page, made fresh on every read
  previewUrl: string | null
  createdAt: string
}

/**
 * The defaults every new post image starts from: what to call the user, the colours the design
 * may use, and the photos they can drop into an image.
 */
export interface BrandSettings {
  displayName: string
  colors: string[]
  assets: BrandAsset[]
  updatedAt: string | null
}

/** What the settings form sends back. Assets are named by the key they were uploaded to. */
export interface BrandSettingsInput {
  displayName: string
  colors: string[]
  assets: { id: string; name: string }[]
}

/** Where a new photo should be uploaded to, signed by the server. */
export interface AssetUploadPlan {
  assetId: string
  url: string
}

/** What the page asks for when it wants an image. */
export interface GenerateImageInput {
  postContent: string
  assetId: string | null
  pose: AssetPoseId
  size: ImageSizeId
}

/**
 * One finished image and the settings it was made with. The settings are a copy taken at the
 * time, not a pointer at the current defaults, so an old image still says how it was made after
 * the defaults change.
 */
export interface PostImage extends WithAiSource {
  id: string
  // A signed link, made fresh on every read; the bucket stays private
  imageUrl: string | null
  width: number
  height: number
  size: number
  postContent: string
  displayName: string
  colors: string[]
  assetName: string | null
  assetUrl: string | null
  pose: AssetPoseId | null
  sizeId: ImageSizeId
  model: string
  // The instructions this image was actually drawn from, kept as they were sent
  prompt: string
  createdAt: string
}

/** What the gallery can filter by. Everything is optional; nothing set means every image. */
export interface PostImageFilters {
  cursor: string | null
  search: string
  size: ImageSizeId | ""
  // A pose, or "none" for images made without a photo
  photo: AssetPoseId | "none" | ""
  from: string | null
  to: string | null
}

export interface PostImagesPage {
  items: PostImage[]
  nextCursor: string | null
  total: number
}

export type PostImagePrompt = EditablePrompt
