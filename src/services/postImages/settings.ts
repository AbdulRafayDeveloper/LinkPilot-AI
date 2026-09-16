import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { BrandSettingsModel, type IBrandAsset, type IBrandSettings } from "@/models/PostImage"
import { presignDownload, presignUpload } from "@/services/storage/s3"
import {
  ASSET_CONTENT_TYPES,
  ASSET_MAX_BYTES,
  MAX_BRAND_ASSETS,
  POST_IMAGES_MESSAGES,
} from "@/constants/postImages"
import type { AssetUploadPlan, BrandAsset, BrandSettings, BrandSettingsInput } from "@/types/postImages"

/**
 * The brand defaults: the name on the posts, the colours a design may use, and the photos that
 * can be dropped into an image. The app has no accounts, so there is one set of defaults, found
 * by a fixed scope rather than by a user.
 *
 * Photos go straight from the browser to S3 through a signed link, the same way every other
 * upload in the app works, and only what the app knows about them is kept here.
 */

const SCOPE = "default"
// Photos sit beside the generated images, under the app's own folder in the bucket
const ASSET_PREFIX = "LinkPilot/post-images/assets"

const extensionFor = (contentType: string) => (contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1] || "png")

/** The key for a new photo. Built here, never taken from the browser. */
const assetKey = (assetId: string, contentType: string) => `${ASSET_PREFIX}/${assetId}.${extensionFor(contentType)}`

async function toBrandAsset(asset: IBrandAsset): Promise<BrandAsset> {
  return {
    id: asset.id,
    name: asset.name,
    contentType: asset.contentType,
    size: asset.size,
    previewUrl: await presignDownload(asset.storageKey, asset.contentType),
    createdAt: (asset.createdAt ?? new Date()).toISOString(),
  }
}

async function toSettings(record: IBrandSettings | null): Promise<BrandSettings> {
  if (!record) return { displayName: "", colors: [], assets: [], updatedAt: null }
  return {
    displayName: record.displayName ?? "",
    colors: record.colors ?? [],
    assets: await Promise.all((record.assets ?? []).map(toBrandAsset)),
    updatedAt: record.updatedAt ? record.updatedAt.toISOString() : null,
  }
}

/** The saved defaults, with a fresh preview link for every photo. */
export async function getBrandSettings(): Promise<BrandSettings> {
  await connectDatabase()
  const record = (await BrandSettingsModel.findOne({ scope: SCOPE }).lean()) as IBrandSettings | null
  return toSettings(record)
}

/** The stored form, for the generation step, which needs the keys rather than links. */
export async function getStoredSettings(): Promise<IBrandSettings | null> {
  await connectDatabase()
  return (await BrandSettingsModel.findOne({ scope: SCOPE }).lean()) as IBrandSettings | null
}

/**
 * Where to upload a new photo. The record is only written once the settings are saved with it,
 * so an upload the user abandoned leaves an object nobody points at rather than a broken entry.
 */
export async function planAssetUpload(contentType: string, size: number): Promise<AssetUploadPlan> {
  if (!ASSET_CONTENT_TYPES.includes(contentType)) throw new UserFacingError(POST_IMAGES_MESSAGES.unsupportedAsset)
  if (!Number.isFinite(size) || size <= 0 || size > ASSET_MAX_BYTES) {
    throw new UserFacingError(POST_IMAGES_MESSAGES.assetTooLarge)
  }
  const current = await getStoredSettings()
  if ((current?.assets.length ?? 0) >= MAX_BRAND_ASSETS) throw new UserFacingError(POST_IMAGES_MESSAGES.tooManyAssets)

  const assetId = new mongoose.Types.ObjectId().toString()
  return { assetId, url: await presignUpload(assetKey(assetId, contentType), contentType) }
}

/**
 * Saves the defaults. Photos are matched to what was uploaded by their id, so a name can be
 * changed and a photo can be dropped from the list without touching the others.
 *
 * A photo taken out of the defaults keeps its object in storage. Images made with it still name
 * it, and deleting it here would leave those records pointing at nothing.
 */
export async function saveBrandSettings(input: BrandSettingsInput, uploads: Map<string, { contentType: string; size: number }>): Promise<BrandSettings> {
  await connectDatabase()
  const current = await getStoredSettings()
  const known = new Map((current?.assets ?? []).map((asset) => [asset.id, asset]))

  const assets: IBrandAsset[] = input.assets.slice(0, MAX_BRAND_ASSETS).map((entry) => {
    const existing = known.get(entry.id)
    if (existing) return { ...existing, name: entry.name.trim() || existing.name }
    const upload = uploads.get(entry.id)
    // An id with nothing uploaded against it is a photo that left the defaults earlier
    if (!upload) throw new UserFacingError(POST_IMAGES_MESSAGES.assetGone)
    return {
      id: entry.id,
      name: entry.name.trim(),
      storageKey: assetKey(entry.id, upload.contentType),
      contentType: upload.contentType,
      size: upload.size,
      createdAt: new Date(),
    }
  })

  const saved = (await BrandSettingsModel.findOneAndUpdate(
    { scope: SCOPE },
    { scope: SCOPE, displayName: input.displayName.trim(), colors: input.colors, assets },
    { upsert: true, returnDocument: "after", runValidators: true }
  ).lean()) as IBrandSettings
  return toSettings(saved)
}

/** One saved photo, by id, for the generation step. */
export async function findAsset(assetId: string): Promise<IBrandAsset | null> {
  const settings = await getStoredSettings()
  return settings?.assets.find((asset) => asset.id === assetId) ?? null
}
