/**
 * The optional detail a task can carry, shared by Daily Tasks and an employee's daily plan.
 */

/** One image, as it is stored on a task: what it is and where its object lives. */
export interface TaskImage {
  // The id the server made for it; the object's key is built from this, never from the browser
  assetId: string
  contentType: string
}

/** The same image as a page receives it, with a short-lived link it can be shown from. */
export interface TaskImageView extends TaskImage {
  url: string
}

/**
 * What a page holds while the details are being written: the description (formatted text, the
 * Markdown subset of lib/richText.ts) and the images already uploaded, each with a link to show
 * it from. `uploading` counts images still on their way, so nothing is saved without them.
 */
export interface TaskDetailsDraft {
  description: string
  images: TaskImageView[]
  uploading: number
}

export const emptyTaskDetails = (): TaskDetailsDraft => ({ description: "", images: [], uploading: 0 })

/** Whether a draft has anything worth saving, so an untouched details area costs nothing. */
export const hasTaskDetails = (details: TaskDetailsDraft): boolean =>
  Boolean(details.description.trim() || details.images.length > 0 || details.uploading > 0)

/** The images as they are saved: what each one is, never the link it happens to be shown from. */
export const toStoredImages = (images: readonly TaskImage[]): TaskImage[] =>
  images.map((image) => ({ assetId: image.assetId, contentType: image.contentType }))

/**
 * A task's images, however it was saved. A task from before several images were allowed has one
 * `image` and no `images`; it reads as a list of that one.
 */
export function storedImagesOf(record: { image?: TaskImage | null; images?: readonly TaskImage[] | null }): TaskImage[] {
  if (record.images && record.images.length > 0) return toStoredImages(record.images)
  return record.image ? toStoredImages([record.image]) : []
}
