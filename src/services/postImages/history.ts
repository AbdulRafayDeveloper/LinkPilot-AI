import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { allOf, createdBetween, olderThanCursor, searchCondition, toCursor } from "@/lib/listQuery"
import { PostImageModel, type IPostImage } from "@/models/PostImage"
import { deleteObject, presignDownload } from "@/services/storage/s3"
import { HISTORY_PAGE_SIZE } from "@/constants/historyFilters"
import { NO_PHOTO_FILTER, type AssetPoseId, type ImageSizeId } from "@/constants/postImages"
import type { PostImage, PostImageFilters, PostImagesPage } from "@/types/postImages"
import type { Viewer } from "@/types/auth"
import { ownedBy, visibleById, visibleTo } from "@/services/auth/viewer"

/**
 * The images made so far, newest first, in batches. Each one carries the settings it was made
 * with, which were copied onto the record at the time, so the history is a record of what
 * happened rather than a view of today's defaults.
 */
type StoredImage = IPostImage & { _id: { toString: () => string } }


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

function photoCondition(photo: PostImageFilters["photo"]) {
  if (!photo) return null
  return photo === NO_PHOTO_FILTER ? { assetName: null } : { assetName: { $ne: null }, pose: photo }
}

/**
 * One batch of images, newest first, never more than HISTORY_PAGE_SIZE. The search (the post
 * content, the photo's name and the name on the image), the shape, the photo and the date range
 * all run in the query, and the total counts every image they match.
 */
export async function listPostImages(viewer: Viewer, filters: PostImageFilters): Promise<PostImagesPage> {
  await connectDatabase()
  const matching = allOf([
    visibleTo(viewer),
    searchCondition(filters.search, ["postContent", "assetName", "displayName"]),
    filters.size ? { sizeId: filters.size } : null,
    photoCondition(filters.photo),
    createdBetween(filters.from, filters.to),
  ])
  const [records, total] = await Promise.all([
    // One extra row answers "is there more?" without a second query
    PostImageModel.find(allOf([matching, olderThanCursor(filters.cursor)]))
      .sort({ createdAt: -1, _id: -1 })
      .limit(HISTORY_PAGE_SIZE + 1)
      .lean(),
    PostImageModel.countDocuments(matching),
  ])
  const stored = records as unknown as StoredImage[]
  const batch = stored.slice(0, HISTORY_PAGE_SIZE)
  return {
    items: await Promise.all(batch.map(toPostImage)),
    nextCursor: stored.length > HISTORY_PAGE_SIZE && batch.length > 0 ? toCursor(batch[batch.length - 1]) : null,
    total,
  }
}

export async function findPostImage(viewer: Viewer, id: string): Promise<PostImage | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const record = (await PostImageModel.findOne(filter).lean()) as unknown as StoredImage | null
  return record ? toPostImage(record) : null
}

/** A link that opens or saves one image, signed for a short while. */
export async function postImageLink(viewer: Viewer, id: string, download: boolean): Promise<{ url: string } | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const record = (await PostImageModel.findOne(filter).lean()) as unknown as StoredImage | null
  if (!record) return null
  const name = `post-image-${record.createdAt.toISOString().slice(0, 10)}.png`
  return { url: await presignDownload(record.storageKey, record.contentType, download ? name : undefined) }
}

/**
 * Removes one image and its record. The stored photo it was made from is left alone, because it
 * belongs to the brand defaults and other images may still name it.
 */
export async function deletePostImage(viewer: Viewer, id: string): Promise<boolean> {
  const filter = visibleById(viewer, id)
  if (!filter) return false
  await connectDatabase()
  const record = (await PostImageModel.findOne(filter).lean()) as unknown as StoredImage | null
  if (!record) return false
  await deleteObject(record.storageKey)
  await PostImageModel.deleteOne(filter)
  return true
}

/**
 * Deletes several images at once: the ones named by `ids`, or every image the filters cover when
 * `ids` is left out. **The picture goes before its record**, one image at a time, the rule the
 * single delete follows: a storage failure then leaves the record rather than leaving a stored
 * picture nothing points at, and it can be deleted again. An image whose picture cannot be removed
 * keeps its record and counts as not deleted. Ticked images stay inside what the viewer may see; a
 * whole filter only ever reaches the viewer's own images.
 */
export async function deletePostImages(
  viewer: Viewer,
  filters: PostImageFilters,
  ids?: string[]
): Promise<{ deleted: number; failed: number }> {
  await connectDatabase()
  const matching = allOf([
    ids ? visibleTo(viewer) : ownedBy(viewer),
    searchCondition(filters.search, ["postContent", "assetName", "displayName"]),
    filters.size ? { sizeId: filters.size } : null,
    photoCondition(filters.photo),
    createdBetween(filters.from, filters.to),
    ids ? { _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } } : null,
  ])
  const records = (await PostImageModel.find(matching).lean()) as unknown as StoredImage[]
  let deleted = 0
  let failed = 0
  for (const record of records) {
    try {
      await deleteObject(record.storageKey)
      await PostImageModel.deleteOne({ _id: record._id })
      deleted += 1
    } catch (error: unknown) {
      console.error("Post images bulk delete: one image could not be removed:", error instanceof Error ? error.message : error)
      failed += 1
    }
  }
  return { deleted, failed }
}
