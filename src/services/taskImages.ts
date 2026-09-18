import mongoose from "mongoose"
import { UserFacingError } from "@/lib/errors"
import { TASK_ATTACHMENT_MESSAGES } from "@/constants/taskAttachments"
import { deleteObject, isStorageConfigured, presignDownload, presignUpload } from "@/services/storage/s3"
import type { TaskImage, TaskImageView } from "@/types/taskAttachment"

/**
 * The one image a task can carry, for Daily Tasks and for an employee's daily plan.
 *
 * The bytes never pass through the app: the browser asks for a link, PUTs the image straight to
 * storage and then saves the id it was given with the task, exactly the way a brand photo is
 * stored (services/postImages/settings.ts). The key is built here from an id the server makes, so
 * nothing the browser sends can point an upload at another object or out of the prefix, and the
 * id carries nothing about the task, the day or the employee it ends up on.
 */

const KEY_PREFIX = "LinkPilot/task-images"

const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }

const keyOf = (image: TaskImage): string => `${KEY_PREFIX}/${image.assetId}.${EXTENSIONS[image.contentType] ?? "png"}`

/** Whether images can be attached at all here, so a page can say so instead of failing oddly. */
export const canAttachImages = isStorageConfigured

/** A link the browser may PUT one image to, with the id to save on the task once it has landed. */
export async function planTaskImageUpload(contentType: string, size: number): Promise<{ assetId: string; url: string }> {
  if (!isStorageConfigured()) throw new UserFacingError(TASK_ATTACHMENT_MESSAGES.storageUnavailable)
  if (size <= 0) throw new UserFacingError(TASK_ATTACHMENT_MESSAGES.unsupportedImage)
  const assetId = new mongoose.Types.ObjectId().toString()
  return { assetId, url: await presignUpload(keyOf({ assetId, contentType }), contentType) }
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
 * The same for a whole list at once, signed in parallel, so a day of tasks costs one round of
 * signing rather than one per task in sequence.
 */
export async function taskImageViews<T>(
  items: T[],
  imageOf: (item: T) => TaskImage | null | undefined
): Promise<Map<T, TaskImageView | null>> {
  const signed = await Promise.all(items.map((item) => taskImageView(imageOf(item))))
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
