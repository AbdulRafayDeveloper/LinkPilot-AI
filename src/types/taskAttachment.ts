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

/** What a task is created or saved with: the description typed, and the image already uploaded. */
export interface TaskDetailsInput {
  description: string
  image: TaskImage | null
}

/** What a page holds while the details are being written: the image may still be uploading. */
export interface TaskDetailsDraft {
  description: string
  // The file chosen, kept only until it has been uploaded
  file: File | null
  image: TaskImage | null
}

export const emptyTaskDetails = (): TaskDetailsDraft => ({ description: "", file: null, image: null })

/** Whether a draft has anything worth saving, so an untouched details area costs nothing. */
export const hasTaskDetails = (details: TaskDetailsDraft): boolean =>
  Boolean(details.description.trim() || details.image || details.file)
