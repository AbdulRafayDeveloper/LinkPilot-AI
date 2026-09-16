import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { PostImageModel, type IPostImage } from "@/models/PostImage"
import { deleteObject, presignDownload } from "@/services/storage/s3"
import { POST_IMAGE_PAGE_SIZE, type AssetPoseId, type ImageSizeId } from "@/constants/postImages"
import type { PostImage, PostImagesPage } from "@/types/postImages"

/**
 * The images made so far, newest first, in batches. Each one carries the settings it was made
 * with, which were copied onto the record at the time, so the history is a record of what
 * happened rather than a view of today's defaults.
 */
type StoredImage = IPostImage & { _id: { toString: () => string } }

const CURSOR_SEPARATOR = "|"
const ID_PATTERN = /^[0-9a-f]{24}$/

/** One record as the page sees it, with fresh signed links and no storage keys. */
export async function toPostImage(record: StoredImage): Promise<PostImage> {
  return {
    id: record._id.toString(),
    imageUrl: await presignDownload(record.storageKey, record.contentType),
    width: record.width,
    height: record.height,
    size: record.size,
    postContent: record.postContent,
    displayName: record.displayName ?? "",
    colors: record.colors ?? [],
    assetName: record.assetName ?? null,
    assetUrl: record.assetStorageKey ? await presignDownload(record.assetStorageKey, "image/png") : null,
    pose: (record.pose as AssetPoseId | null) ?? null,
    sizeId: record.sizeId as ImageSizeId,
    model: record.model,
    prompt: record.prompt,
    createdAt: record.createdAt.toISOString(),
  }
}

const toCursor = (record: StoredImage) => `${record.createdAt.toISOString()}${CURSOR_SEPARATOR}${record._id.toString()}`

/**
 * Everything older than the image the cursor points at. An unreadable cursor is ignored rather
 * than failing the request, so a stale browser tab simply starts again from the newest image.
 */
function olderThan(cursor: string | null) {
  const [time, id] = (cursor ?? "").split(CURSOR_SEPARATOR)
  const createdAt = new Date(time ?? "")
  if (!cursor || Number.isNaN(createdAt.getTime()) || !ID_PATTERN.test(id ?? "")) return {}
  return { $or: [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: new mongoose.Types.ObjectId(id) } }] }
}

export async function listPostImages(cursor: string | null = null, limit = POST_IMAGE_PAGE_SIZE): Promise<PostImagesPage> {
  await connectDatabase()
  const size = Math.min(Math.max(1, Math.trunc(limit) || POST_IMAGE_PAGE_SIZE), POST_IMAGE_PAGE_SIZE)
  const [records, total] = await Promise.all([
    // One extra row answers "is there more?" without a second count
    PostImageModel.find(olderThan(cursor)).sort({ createdAt: -1, _id: -1 }).limit(size + 1).lean(),
    PostImageModel.countDocuments({}),
  ])
  const stored = records as unknown as StoredImage[]
  const batch = stored.slice(0, size)
  return {
    items: await Promise.all(batch.map(toPostImage)),
    nextCursor: stored.length > size && batch.length > 0 ? toCursor(batch[batch.length - 1]) : null,
    total,
  }
}

export async function findPostImage(id: string): Promise<PostImage | null> {
  if (!ID_PATTERN.test(id)) return null
  await connectDatabase()
  const record = (await PostImageModel.findById(id).lean()) as unknown as StoredImage | null
  return record ? toPostImage(record) : null
}

/** A link that opens or saves one image, signed for a short while. */
export async function postImageLink(id: string, download: boolean): Promise<{ url: string } | null> {
  if (!ID_PATTERN.test(id)) return null
  await connectDatabase()
  const record = (await PostImageModel.findById(id).lean()) as unknown as StoredImage | null
  if (!record) return null
  const name = `post-image-${record.createdAt.toISOString().slice(0, 10)}.png`
  return { url: await presignDownload(record.storageKey, record.contentType, download ? name : undefined) }
}

/**
 * Removes one image and its record. The stored photo it was made from is left alone, because it
 * belongs to the brand defaults and other images may still name it.
 */
export async function deletePostImage(id: string): Promise<boolean> {
  if (!ID_PATTERN.test(id)) return false
  await connectDatabase()
  const record = (await PostImageModel.findById(id).lean()) as unknown as StoredImage | null
  if (!record) return false
  await deleteObject(record.storageKey)
  await PostImageModel.deleteOne({ _id: id })
  return true
}
