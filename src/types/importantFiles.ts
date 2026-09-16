import type { AssetCategoryId, AssetFilterId } from "@/constants/importantFiles"

/**
 * One stored file as the page sees it. The storage key never leaves the server: previews and
 * downloads are short-lived signed links, so nothing here can be turned into a permanent URL.
 */
export interface Asset {
  id: string
  name: string
  description: string
  originalName: string
  contentType: string
  category: AssetCategoryId
  size: number
  // A signed link for showing the file in the page, null for types nothing can preview
  previewUrl: string | null
  createdAt: string
  updatedAt: string
}

/**
 * One batch of files, newest first. `nextCursor` asks for the batch after this one and is null
 * at the end. A cursor points at a file rather than counting from the start, so adding or
 * deleting while browsing never makes the next batch skip or repeat one. `total` counts
 * everything the current search and filter match.
 */
export interface AssetsPage {
  items: Asset[]
  nextCursor: string | null
  total: number
}

/** What the user can change afterwards. The stored file itself is never touched by an edit. */
export interface AssetMetadataInput {
  name: string
  description: string
}

/** What the page tells the server before it starts uploading. */
export interface UploadRequest extends AssetMetadataInput {
  originalName: string
  contentType: string
  size: number
}

/**
 * How to send this file to S3. `single` is one PUT for anything small; `multipart` is a list of
 * part URLs for everything over the threshold, which is what keeps a large file out of the app's
 * own request. Either way the bytes go straight from the browser to S3.
 */
export type UploadPlan =
  | { assetId: string; mode: "single"; url: string }
  | { assetId: string; mode: "multipart"; partSize: number; urls: { partNumber: number; url: string }[] }

/** Where an upload has got to, for the dialog and for anything left behind by a failure. */
export type UploadStage = "preparing" | "uploading" | "finishing" | "done" | "failed" | "cancelled"

export interface UploadProgress {
  stage: UploadStage
  // 0 to 100, counted from the bytes S3 has actually accepted
  percent: number
  error: string | null
}

export interface AssetQuery {
  search: string
  type: AssetFilterId
  cursor: string | null
}
