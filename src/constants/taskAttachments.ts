import { POST_IMAGE_MAX_BYTES, POST_IMAGE_TYPES } from "./postInput"

/**
 * What a task can carry besides its one line: a longer description, and one image.
 *
 * Both are optional and both are written the same way wherever a task is created, so Daily Tasks
 * and an employee's daily plan share this one set of limits, the one upload route
 * (`services/taskImages.ts`) and the one block of fields (`components/tasks/TaskDetailsFields`).
 */

// A description is a note under the task, not a document; the task's own line stays the title
export const TASK_DESCRIPTION_MAX_LENGTH = 6000

/**
 * The image limits are deliberately the post screenshot limits. The picker is the shared
 * `components/post-input/ImageDropzone`, which checks a file against those before it leaves the
 * browser, so holding a task image to anything else would let the browser accept a file the
 * server then refuses.
 */
export const TASK_IMAGE_TYPES = POST_IMAGE_TYPES
export const TASK_IMAGE_MAX_BYTES = POST_IMAGE_MAX_BYTES

// Where the browser sends one image to be stored (through the app, so it works on the live site)
export const TASK_IMAGES_ENDPOINT = "/api/task-images"

// How many images one task can carry; a task saved before several were allowed has its one image as the first
export const TASK_MAX_IMAGES = 6

/**
 * How deep tasks nest: a task (1), its subtask (2) and that subtask's own subtask (3). One more is
 * refused by the server, and the button that would add it is disabled.
 */
export const TASK_MAX_DEPTH = 3

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
  imagesLabel: "Images",
  addImages: "Add images",
  tooManyImages: `A task can carry up to ${TASK_MAX_IMAGES} images.`,
  // Subtasks, in Daily Tasks and in an employee's plan alike
  tooDeep: `Tasks go ${TASK_MAX_DEPTH} levels deep at most: a task, its subtask and that subtask's own subtask.`,
  missingParent: "The task this was added under no longer exists.",
  addSubtask: "Add subtask",
  addSubSubtask: "Add sub-subtask",
  subtaskPlaceholder: "A smaller step of this task",
  depthReached: "This is already a sub-subtask, the deepest a task goes.",
  // The icon that copies the task's own line, so it can be pasted anywhere
  // The fold on a task that already carries something, as against one that has nothing yet
  showDetails: "Show details",
  copyText: "Copy the task text",
  // Writing the details with AI, from the task's own line (and the tasks above it)
  generate: "Write with AI",
  generating: "Writing...",
  generateFailed: "Couldn't write the details. Please try again.",
  generateNeedsTitle: "Give the task a name first, so there is something to write about.",
  // Saving the details of a task already written, as they are typed
  autosaving: "Saving...",
  autosaved: (time: string) => `Saved at ${time}`,
  autosaveFailed: "Couldn't save the last change. Save tries again.",
} as const
