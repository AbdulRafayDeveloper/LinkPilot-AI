import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { AssetFile, type IAssetFile } from "@/models/AssetFile"
import {
  ASSET_PAGE_SIZE,
  IMPORTANT_FILES_MESSAGES,
  MULTIPART_THRESHOLD_BYTES,
  UPLOAD_PART_BYTES,
  categoryForContentType,
  maxBytesFor,
  type AssetCategoryId,
  type AssetFilterId,
} from "@/constants/importantFiles"
import type { Asset, AssetMetadataInput, AssetsPage, UploadPlan, UploadRequest } from "@/types/importantFiles"
import type { Viewer } from "@/types/auth"
import { visibleById, visibleTo } from "@/services/auth/viewer"
import {
  abortMultipartUpload,
  buildStorageKey,
  completeMultipartUpload,
  deleteObject,
  headObject,
  presignDownload,
  presignParts,
  presignUpload,
  startMultipartUpload,
} from "@/services/storage/s3"

/**
 * Important Files live in the important_files collection, read newest first in batches. The
 * file itself is in S3; this is only what the app knows about it.
 *
 * A record is written before the browser starts uploading and stays "uploading" until S3 has
 * confirmed the finished object, so a list only ever shows files that are really there.
 */
type StoredAsset = IAssetFile & { _id: { toString: () => string } }

const CURSOR_SEPARATOR = "|"
const ID_PATTERN = /^[0-9a-f]{24}$/
// Types the page can show something for; everything else gets its icon and a download
const PREVIEWABLE: AssetCategoryId[] = ["image", "video", "audio", "pdf", "text"]

const toAsset = (record: StoredAsset, previewUrl: string | null): Asset => ({
  id: record._id.toString(),
  name: record.name,
  description: record.description ?? "",
  originalName: record.originalName,
  contentType: record.contentType,
  category: record.category as AssetCategoryId,
  size: record.size,
  previewUrl,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
})

// A cursor points at the last file of a batch: its time, and its id to separate files sharing one
const toCursor = (record: StoredAsset) => `${record.createdAt.toISOString()}${CURSOR_SEPARATOR}${record._id.toString()}`

// Anything the regular expression engine would read is escaped, so a search is plain text
const escapeForSearch = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)

/**
 * Everything older than the file the cursor points at. An unreadable cursor is ignored rather
 * than failing the request, so a stale browser tab simply starts again from the newest file.
 */
function olderThan(cursor: string | null) {
  const [time, id] = (cursor ?? "").split(CURSOR_SEPARATOR)
  const createdAt = new Date(time ?? "")
  if (!cursor || Number.isNaN(createdAt.getTime()) || !ID_PATTERN.test(id ?? "")) return []
  return [{ $or: [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: new mongoose.Types.ObjectId(id) } }] }]
}

// The search matches the name the user gave the file, as typed
function matching(search: string) {
  const term = search.trim()
  if (!term) return []
  return [{ name: new RegExp(escapeForSearch(term), "i") }]
}

const inCategory = (type: AssetFilterId) => (type === "all" ? [] : [{ category: type }])

interface ListOptions {
  search?: string
  type?: AssetFilterId
  cursor?: string | null
  limit?: number
}

/**
 * One batch of files, newest first, for the current search and filter. Never more than
 * ASSET_PAGE_SIZE, whatever the caller asks for, and never a file whose upload never finished.
 * Each file carries a short-lived preview link rather than anything permanent.
 */
export async function listAssets(viewer: Viewer, {
  search = "",
  type = "all",
  cursor = null,
  limit = ASSET_PAGE_SIZE,
}: ListOptions = {}): Promise<AssetsPage> {
  await connectDatabase()
  const size = Math.min(Math.max(1, Math.trunc(limit) || ASSET_PAGE_SIZE), ASSET_PAGE_SIZE)
  const ready = [{ status: "ready" as const }, visibleTo(viewer), ...matching(search), ...inCategory(type)]
  const [records, total] = await Promise.all([
    // One extra row answers "is there more?" without a second count
    AssetFile.find({ $and: [...ready, ...olderThan(cursor)] })
      .sort({ createdAt: -1, _id: -1 })
      .limit(size + 1)
      .lean(),
    // The total counts what the search and filter match, so the header follows both
    AssetFile.countDocuments({ $and: ready }),
  ])
  const stored = records as unknown as StoredAsset[]
  const batch = stored.slice(0, size)
  const items = await Promise.all(
    batch.map(async (record) =>
      toAsset(
        record,
        PREVIEWABLE.includes(record.category as AssetCategoryId)
          ? await presignDownload(record.storageKey, record.contentType)
          : null
      )
    )
  )

  return {
    items,
    nextCursor: stored.length > size && batch.length > 0 ? toCursor(batch[batch.length - 1]) : null,
    total,
  }
}

async function findReady(viewer: Viewer, id: string): Promise<StoredAsset | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const record = await AssetFile.findOne({ ...filter, status: "ready" }).lean()
  return (record as unknown as StoredAsset) ?? null
}

/**
 * Checks what the browser says it is about to upload before anything is stored: a type the app
 * accepts, and a size that type allows. The same limits are the only ones the page shows, so a
 * page that ignored them still gets the same answer here.
 */
function checkUpload(contentType: string, size: number): AssetCategoryId {
  const category = categoryForContentType(contentType)
  if (!category) throw new UserFacingError(IMPORTANT_FILES_MESSAGES.unsupportedType)
  if (!Number.isFinite(size) || size <= 0) throw new UserFacingError(IMPORTANT_FILES_MESSAGES.missingFile)
  if (size > maxBytesFor(category)) throw new UserFacingError(IMPORTANT_FILES_MESSAGES.tooLarge)
  return category
}

/**
 * Registers the file and hands back the links the browser uploads it with. Nothing is stored
 * yet: the record is "uploading" until finishUpload confirms the object with S3.
 *
 * Small files go up in one PUT. Anything over MULTIPART_THRESHOLD_BYTES is split into parts, so
 * the app never carries the bytes and Vercel's request limit never applies to them.
 */
export async function planUpload(viewer: Viewer, { name, description, originalName, contentType, size }: UploadRequest): Promise<UploadPlan> {
  const category = checkUpload(contentType, size)
  await connectDatabase()

  const record = await AssetFile.create({
    ownerId: viewer.id,
    name: name.trim(),
    description: description.trim(),
    originalName,
    contentType,
    category,
    size,
    // Replaced below, once the record's own id is known
    storageKey: `pending/${new mongoose.Types.ObjectId().toString()}`,
    status: "uploading",
  })
  const assetId = String(record._id)
  const storageKey = buildStorageKey(assetId, originalName)

  try {
    if (size <= MULTIPART_THRESHOLD_BYTES) {
      const url = await presignUpload(storageKey, contentType)
      await AssetFile.updateOne({ _id: assetId }, { storageKey })
      return { assetId, mode: "single", url }
    }

    const uploadId = await startMultipartUpload(storageKey, contentType)
    const partCount = Math.ceil(size / UPLOAD_PART_BYTES)
    const urls = await presignParts(storageKey, uploadId, partCount)
    await AssetFile.updateOne({ _id: assetId }, { storageKey, uploadId })
    return { assetId, mode: "multipart", partSize: UPLOAD_PART_BYTES, urls }
  } catch (error: unknown) {
    // Nothing was stored, so the half-made record goes rather than sitting in the collection
    await AssetFile.deleteOne({ _id: assetId }).catch(() => undefined)
    throw error
  }
}

/**
 * Turns an uploaded object into a file the module lists. S3 is asked what it actually holds,
 * and an object that is missing, empty or larger than the type allows is deleted with its
 * record instead of being shown. Finishing twice is harmless.
 */
export async function finishUpload(viewer: Viewer, id: string): Promise<Asset> {
  const filter = visibleById(viewer, id)
  if (!filter) throw new UserFacingError(IMPORTANT_FILES_MESSAGES.notFound)
  await connectDatabase()
  const record = (await AssetFile.findOne(filter).lean()) as unknown as StoredAsset | null
  if (!record) throw new UserFacingError(IMPORTANT_FILES_MESSAGES.notFound)
  if (record.status === "ready") return toAsset(record, await presignDownload(record.storageKey, record.contentType))

  if (record.uploadId) await completeMultipartUpload(record.storageKey, record.uploadId)

  const stored = await headObject(record.storageKey)
  if (!stored || stored.size === 0) {
    await AssetFile.deleteOne({ _id: id })
    throw new UserFacingError(IMPORTANT_FILES_MESSAGES.uploadFailed)
  }
  // The size is the one S3 has, not the one the browser claimed before uploading
  if (stored.size > maxBytesFor(record.category as AssetCategoryId)) {
    await deleteObject(record.storageKey).catch(() => undefined)
    await AssetFile.deleteOne({ _id: id })
    throw new UserFacingError(IMPORTANT_FILES_MESSAGES.tooLarge)
  }

  const ready = (await AssetFile.findByIdAndUpdate(
    id,
    { status: "ready", size: stored.size, uploadId: null },
    { returnDocument: "after" }
  ).lean()) as unknown as StoredAsset
  console.info(
    "Important file stored:",
    JSON.stringify({ category: ready.category, contentType: ready.contentType, bytes: ready.size, multipart: Boolean(record.uploadId) })
  )
  return toAsset(ready, await presignDownload(ready.storageKey, ready.contentType))
}

/**
 * Drops an upload that never finished: the multipart upload is aborted, anything already
 * stored is removed, and the record goes with it, so a cancelled or broken upload leaves
 * nothing behind. A record that is already "ready" is left alone.
 */
export async function cancelUpload(viewer: Viewer, id: string): Promise<boolean> {
  const filter = visibleById(viewer, id)
  if (!filter) return false
  await connectDatabase()
  const record = (await AssetFile.findOne({ ...filter, status: "uploading" }).lean()) as unknown as StoredAsset | null
  if (!record) return false
  if (record.uploadId) await abortMultipartUpload(record.storageKey, record.uploadId)
  await deleteObject(record.storageKey).catch(() => undefined)
  await AssetFile.deleteOne({ _id: id })
  return true
}

/**
 * Changes only what the user typed. The stored object is never touched here, which is why an
 * edit cannot replace the file behind a name.
 */
export async function updateAssetMetadata(viewer: Viewer, id: string, { name, description }: AssetMetadataInput): Promise<Asset | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const record = (await AssetFile.findOneAndUpdate(
    { ...filter, status: "ready" },
    { name: name.trim(), description: description.trim() },
    { returnDocument: "after", runValidators: true }
  ).lean()) as unknown as StoredAsset | null
  return record ? toAsset(record, await presignDownload(record.storageKey, record.contentType)) : null
}

/**
 * Removes the file and its record. The object goes first: if S3 refuses, the record stays and
 * the user is told, so the app never forgets about a file that is still stored.
 */
export async function deleteAsset(viewer: Viewer, id: string): Promise<boolean> {
  const filter = visibleById(viewer, id)
  if (!filter) return false
  await connectDatabase()
  const record = (await AssetFile.findOne(filter).lean()) as unknown as StoredAsset | null
  if (!record) return false
  if (record.uploadId) await abortMultipartUpload(record.storageKey, record.uploadId)
  await deleteObject(record.storageKey)
  await AssetFile.deleteOne({ _id: id })
  return true
}

/** A link that opens or saves one file, signed for a short while. */
export async function assetLink(viewer: Viewer, id: string, download: boolean): Promise<{ url: string } | null> {
  const record = await findReady(viewer, id)
  if (!record) return null
  const downloadAs = download ? `${record.name}${extensionOf(record.originalName)}` : undefined
  return { url: await presignDownload(record.storageKey, record.contentType, downloadAs) }
}

// Saved under the name the user gave it, keeping the original extension so it still opens
function extensionOf(originalName: string): string {
  const match = originalName.match(/(\.[A-Za-z0-9]{1,8})$/)
  return match ? match[1].toLowerCase() : ""
}

/** The text of a stored text file, for the copy action, capped so a huge file cannot be pulled in. */
export async function assetText(viewer: Viewer, id: string, maxBytes: number): Promise<string | null> {
  const record = await findReady(viewer, id)
  if (!record || record.category !== "text") return null
  if (record.size > maxBytes) return null
  const url = await presignDownload(record.storageKey, record.contentType)
  const response = await fetch(url)
  if (!response.ok) return null
  return response.text()
}
