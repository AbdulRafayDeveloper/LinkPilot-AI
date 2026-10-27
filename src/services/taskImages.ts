import mongoose from "mongoose"
import { UserFacingError } from "@/lib/errors"
import { assertOwnAttachments, ownedAttachmentIds, recordAttachmentOwner } from "@/services/attachmentOwners"
import { detectImageMimeType } from "@/lib/imageType"
import { TASK_ATTACHMENT_MESSAGES, TASK_IMAGE_MAX_BYTES } from "@/constants/taskAttachments"
import { deleteObject, isStorageConfigured, presignDownload, presignUpload, putObject } from "@/services/storage/s3"
import type { TaskImage, TaskImageView } from "@/types/taskAttachment"

/**
 * The images a task can carry, for Daily Tasks and for an employee's daily plan.
 *
 * The browser sends each image to the app (`storeTaskImage`), which reads its type from the bytes
 * and stores it. It used to PUT the bytes straight to storage with a signed link, but the bucket's
 * CORS rule refuses browser uploads from the live site, so that never worked there; the signed-link
 * path (`planTaskImageUpload`) is kept for any caller still using it. One image is at most 4 MB,
 * which fits the 4.5 MB body a Vercel function takes.
 *
 * The key is always built here from an id the server makes, so nothing the browser sends can point
 * an upload at another object or out of the prefix, and the id carries nothing about the task, the
 * day or the employee it ends up on.
 *
 * **Every upload records whose it is** (`task_images`, models/TaskImageOwner.ts), because the id says
 * nothing about it: a task saved naming another account's image would otherwise show that image and
 * delete it from storage when the task let it go. `assertOwnImages` is what a save checks, and
 * `deleteOwnedTaskImages` only ever removes the objects of the account the task belongs to.
 */

const KEY_PREFIX = "LinkPilot/task-images"

const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }

const keyOf = (image: TaskImage): string => `${KEY_PREFIX}/${image.assetId}.${EXTENSIONS[image.contentType] ?? "png"}`

/** Whether images can be attached at all here, so a page can say so instead of failing oddly. */
export const canAttachImages = isStorageConfigured

/** A link the browser may PUT one image to, with the id to save on the task once it has landed. */
export async function planTaskImageUpload(ownerId: string, contentType: string, size: number): Promise<{ assetId: string; url: string }> {
  if (!isStorageConfigured()) throw new UserFacingError(TASK_ATTACHMENT_MESSAGES.storageUnavailable)
  if (size <= 0) throw new UserFacingError(TASK_ATTACHMENT_MESSAGES.unsupportedImage)
  const assetId = new mongoose.Types.ObjectId().toString()
  await recordOwner(assetId, ownerId, contentType)
  return { assetId, url: await presignUpload(keyOf({ assetId, contentType }), contentType) }
}

// Notes whose an image is, before anything can name it
const recordOwner = (assetId: string, ownerId: string, contentType: string) => recordAttachmentOwner(assetId, ownerId, "task-image", contentType)

/**
 * Refuses a save that names an image the task's account did not upload. An image the task already
 * carries is always allowed (it was checked when it was first saved), so keeping one never needs the
 * list; a new one must be in it under that account.
 */
export async function assertOwnImages(
  ownerId: string | null | readonly (string | null)[],
  images: TaskImage[],
  alreadyOnTask: TaskImage[] = []
): Promise<void> {
  await assertOwnAttachments(
    ownerId,
    "task-image",
    images.map((image) => image.assetId),
    alreadyOnTask.map((image) => image.assetId),
    TASK_ATTACHMENT_MESSAGES.imageNotYours
  )
}

/**
 * Removes the objects of images a task no longer has, **only those its own account uploaded**, with
 * their owner rows. Anything else a task names is left in storage for its real owner. A storage
 * failure is logged and swallowed, as `deleteTaskImages` does.
 */
export async function deleteOwnedTaskImages(entries: { ownerId: string | null | readonly (string | null)[]; image: TaskImage | null | undefined }[]): Promise<void> {
  const theirs = await ownedAttachmentIds("task-image", entries.map((entry) => ({ assetId: entry.image?.assetId, owners: entry.ownerId })))
  // One object may be named by several entries (a plan and each of its days), so it goes once
  const images = new Map(entries.flatMap((entry) => (entry.image && theirs.has(entry.image.assetId) ? [[entry.image.assetId, entry.image] as const] : [])))
  await deleteTaskImages([...images.values()])
}

/**
 * Stores one image the browser sent, as bytes, and answers what to save on the task with a link to
 * show it from straight away. Anything that isn't a PNG, JPEG or WEBP by its own bytes is refused.
 */
export async function storeTaskImage(ownerId: string, bytes: Buffer): Promise<TaskImageView> {
  if (!isStorageConfigured()) throw new UserFacingError(TASK_ATTACHMENT_MESSAGES.storageUnavailable)
  if (bytes.length > TASK_IMAGE_MAX_BYTES) throw new UserFacingError(TASK_ATTACHMENT_MESSAGES.imageTooLarge)
  const contentType = bytes.length > 0 ? detectImageMimeType(bytes) : null
  if (!contentType) throw new UserFacingError(TASK_ATTACHMENT_MESSAGES.unsupportedImage)
  const image: TaskImage = { assetId: new mongoose.Types.ObjectId().toString(), contentType }
  await putObject(keyOf(image), bytes, contentType)
  await recordOwner(image.assetId, ownerId, contentType)
  return { ...image, url: await presignDownload(keyOf(image), contentType) }
}

/**
 * A task's image with a short-lived link to show it from, or null when the task has none. A link
 * that cannot be signed (storage switched off since it was saved) leaves the task readable rather
 * than failing the whole list.
 */
export async function taskImageView(image: TaskImage | null | undefined): Promise<TaskImageView | null> {
  if (!image?.assetId || !isStorageConfigured()) return null
  try {
    // Built field by field, never spread: on the create path this is still a Mongoose subdocument,
    // and spreading one copies its internals instead of the two fields the page needs
    return { assetId: image.assetId, contentType: image.contentType, url: await presignDownload(keyOf(image), image.contentType) }
  } catch (error: unknown) {
    console.warn("⚠️ Couldn't sign a task image link:", error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Every image of every item in a list, signed in parallel, so a day of tasks costs one round of
 * signing rather than one per image in sequence. An image that can't be signed is left out.
 */
export async function taskImageLists<T>(items: T[], imagesOf: (item: T) => TaskImage[]): Promise<Map<T, TaskImageView[]>> {
  const signed = await Promise.all(items.map(async (item) => (await Promise.all(imagesOf(item).map(taskImageView))).filter((view): view is TaskImageView => view !== null)))
  return new Map(items.map((item, index) => [item, signed[index]]))
}


/**
 * Removes the objects of images a task no longer has. A failure is logged and swallowed: losing
 * an object nothing points at any more must never fail the change the user asked for.
 */
export async function deleteTaskImages(images: (TaskImage | null | undefined)[]): Promise<void> {
  const keys = images.filter((image): image is TaskImage => Boolean(image?.assetId)).map(keyOf)
  if (keys.length === 0 || !isStorageConfigured()) return
  await Promise.all(
    keys.map((key) =>
      deleteObject(key).catch((error: unknown) =>
        console.warn("⚠️ Couldn't remove a task image:", error instanceof Error ? error.message : error)
      )
    )
  )
}
