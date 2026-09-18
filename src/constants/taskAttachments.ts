import { POST_IMAGE_MAX_BYTES, POST_IMAGE_TYPES } from "./postInput"

/**
 * What a task can carry besides its one line: a longer description, and one image.
 *
 * Both are optional and both are written the same way wherever a task is created, so Daily Tasks
 * and an employee's daily plan share this one set of limits, the one upload route
 * (`services/taskImages.ts`) and the one block of fields (`components/tasks/TaskDetailsFields`).
 */

// A description is a note under the task, not a document; the task's own line stays the title
export const TASK_DESCRIPTION_MAX_LENGTH = 2000

/**
 * The image limits are deliberately the post screenshot limits. The picker is the shared
 * `components/post-input/ImageDropzone`, which checks a file against those before it leaves the
 * browser, so holding a task image to anything else would let the browser accept a file the
 * server then refuses.
 */
export const TASK_IMAGE_TYPES = POST_IMAGE_TYPES
export const TASK_IMAGE_MAX_BYTES = POST_IMAGE_MAX_BYTES

// Where the browser asks for a link to upload one image to
export const TASK_IMAGES_ENDPOINT = "/api/task-images"

export const TASK_ATTACHMENT_MESSAGES = {
  descriptionTooLong: `A description must be under ${TASK_DESCRIPTION_MAX_LENGTH.toLocaleString()} characters.`,
  unsupportedImage: "Upload a PNG, JPG or WEBP image.",
  imageTooLarge: `Images must be ${TASK_IMAGE_MAX_BYTES / (1024 * 1024)} MB or smaller.`,
  uploadFailed: "Couldn't upload that image. Please try again.",
  storageUnavailable: "Images can't be uploaded here yet: file storage isn't set up.",
  invalidImage: "That image is no longer available.",
  // What the details area calls itself wherever it is opened
  addDetails: "Add details",
  hideDetails: "Hide details",
  descriptionLabel: "Description",
  descriptionHint: "Anything worth remembering about this task.",
  imageLabel: "Image",
} as const
