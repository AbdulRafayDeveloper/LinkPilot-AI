import { z } from "zod"
import {
  TASK_ATTACHMENT_MESSAGES,
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_IMAGE_MAX_BYTES,
  TASK_IMAGE_TYPES,
} from "@/constants/taskAttachments"

/**
 * The optional detail a task is saved with. The description is plain text, kept as it was typed;
 * the image is only ever the id the server issued and the type it was uploaded as, so nothing the
 * browser sends can point a task at another object.
 */

const ASSET_ID = /^[0-9a-f]{24}$/

export const TaskImageSchema = z.object({
  assetId: z.string().trim().regex(ASSET_ID, TASK_ATTACHMENT_MESSAGES.invalidImage),
  contentType: z.string().trim().refine((type) => TASK_IMAGE_TYPES.includes(type), TASK_ATTACHMENT_MESSAGES.unsupportedImage),
})

export const TaskDescriptionSchema = z
  .string()
  .max(TASK_DESCRIPTION_MAX_LENGTH, TASK_ATTACHMENT_MESSAGES.descriptionTooLong)
  .optional()
  .default("")
  .transform((value) => value.trim())

/** The two optional fields, as every create and save accepts them. */
export const TaskDetailsSchema = z.object({
  description: TaskDescriptionSchema,
  image: TaskImageSchema.nullish().transform((value) => value ?? null),
})

/**
 * The detail of a task already written, as its edit saves it. Unlike a new task, **both** fields
 * are required: an edit always sends the whole of it, so a request that left them out could
 * otherwise clear a task's description and image without anyone meaning to.
 */
export const TaskDetailsEditSchema = z
  .object({
    description: z.string().max(TASK_DESCRIPTION_MAX_LENGTH, TASK_ATTACHMENT_MESSAGES.descriptionTooLong).transform((value) => value.trim()),
    image: TaskImageSchema.nullable(),
  })
  .strict()

/** What the browser asks an upload link for: the type and size it is about to send. */
export const TaskImageUploadSchema = z.object({
  contentType: z.string().trim().refine((type) => TASK_IMAGE_TYPES.includes(type), TASK_ATTACHMENT_MESSAGES.unsupportedImage),
  size: z
    .number()
    .int()
    .positive(TASK_ATTACHMENT_MESSAGES.unsupportedImage)
    .max(TASK_IMAGE_MAX_BYTES, TASK_ATTACHMENT_MESSAGES.imageTooLarge),
})
