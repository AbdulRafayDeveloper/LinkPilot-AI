import { z } from "zod"
import {
  TASK_ATTACHMENT_MESSAGES,
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_IMAGE_MAX_BYTES,
  TASK_IMAGE_TYPES,
  TASK_MAX_DEPTH,
  TASK_MAX_IMAGES,
} from "@/constants/taskAttachments"
import { DAILY_TASKS_MESSAGES, DAILY_TASK_DESCRIPTION_MAX_LENGTH, TASK_MAX_LENGTH } from "@/constants/dailyTasks"

/**
 * The optional detail a task is saved with. The description is formatted text (the Markdown subset
 * of lib/richText.ts; plain text reads as itself), kept as it was typed; an image is only ever the id
 * the server issued and the type it was uploaded as, so nothing the browser sends can point a task at
 * another object.
 *
 * A task carries up to TASK_MAX_IMAGES images as `images`. The single `image` of the first version is
 * still accepted, and a body that sends neither `images` nor anything new answers exactly as before,
 * so every caller written for one image goes on working.
 */

const ASSET_ID = /^[0-9a-f]{24}$/

export const TaskImageSchema = z.object({
  assetId: z.string().trim().regex(ASSET_ID, TASK_ATTACHMENT_MESSAGES.invalidImage),
  contentType: z.string().trim().refine((type) => TASK_IMAGE_TYPES.includes(type), TASK_ATTACHMENT_MESSAGES.unsupportedImage),
})

/**
 * A description, as long as the place it is written allows. **How long differs by place, on
 * purpose**: Daily Tasks holds a million characters (a task is its own document and nothing but the
 * user reads the whole of one), while an employee's plan keeps the shared 6,000, since a plan's
 * tasks all live in one array inside one document.
 */
export const taskDescriptionSchema = (max: number) =>
  z
    .string()
    .max(max, TASK_ATTACHMENT_MESSAGES.descriptionTooLong(max))
    .optional()
    .default("")
    .transform((value) => value.trim())

export const TaskDescriptionSchema = taskDescriptionSchema(TASK_DESCRIPTION_MAX_LENGTH)

export const TaskImagesSchema = z.array(TaskImageSchema).max(TASK_MAX_IMAGES, TASK_ATTACHMENT_MESSAGES.tooManyImages)

/** The optional fields, as every create and save accepts them, with the caller's own limit. */
export const taskDetailsSchema = (max: number) =>
  z.object({
    description: taskDescriptionSchema(max),
    image: TaskImageSchema.nullish().transform((value) => value ?? null),
    // Several images; when sent, these are the task's images and `image` is only the first version's field
    images: TaskImagesSchema.optional(),
  })

/** The shared limit, which is what an employee's plan uses. */
export const TaskDetailsSchema = taskDetailsSchema(TASK_DESCRIPTION_MAX_LENGTH)

/** Daily Tasks, whose description is a plain text box. */
export const DailyTaskDetailsSchema = taskDetailsSchema(DAILY_TASK_DESCRIPTION_MAX_LENGTH)

/**
 * The detail of a **daily task** already written, as its editor saves it (`content` and
 * `generateAI` are that editor's own fields). Unlike a new task, **both** detail fields are
 * required: an edit always sends the whole of it, so a request that left them out could otherwise
 * clear a task's description and image without anyone meaning to.
 */
export const TaskDetailsEditSchema = z
  .object({
    description: z
      .string()
      .max(DAILY_TASK_DESCRIPTION_MAX_LENGTH, TASK_ATTACHMENT_MESSAGES.descriptionTooLong(DAILY_TASK_DESCRIPTION_MAX_LENGTH))
      .transform((value) => value.trim()),
    // The first version's one image, or the list of them: one of the two is always sent
    image: TaskImageSchema.nullable().optional(),
    images: TaskImagesSchema.optional(),
    // The task's own line, changed from its editor; left out, it stays as it is
    content: z
      .string()
      .transform((value) => value.trim().replace(/\s+/g, " "))
      .pipe(z.string().min(1, DAILY_TASKS_MESSAGES.missingContent).max(TASK_MAX_LENGTH, DAILY_TASKS_MESSAGES.contentTooLong))
      .optional(),
    // Writes the description with AI from the task's line (and the tasks above it) before saving
    generateAI: z.literal(true).optional(),
  })
  .strict()
  .refine((body) => body.image !== undefined || body.images !== undefined, {
    message: TASK_ATTACHMENT_MESSAGES.invalidImage,
    path: ["images"],
  })

/** What the browser asks an upload link for: the type and size it is about to send. */
export const TaskImageUploadSchema = z.object({
  contentType: z.string().trim().refine((type) => TASK_IMAGE_TYPES.includes(type), TASK_ATTACHMENT_MESSAGES.unsupportedImage),
  size: z
    .number()
    .int()
    .positive(TASK_ATTACHMENT_MESSAGES.unsupportedImage)
    .max(TASK_IMAGE_MAX_BYTES, TASK_ATTACHMENT_MESSAGES.imageTooLarge),
})

/**
 * What writing a task's details with AI is asked with: the task's own line, the tasks above it (the
 * top one first, at most the two a sub-subtask has) and whatever is already written.
 */
export const WriteDetailsSchema = z.object({
  title: z
    .string({ error: TASK_ATTACHMENT_MESSAGES.generateNeedsTitle })
    .transform((value) => value.trim())
    .pipe(z.string().min(1, TASK_ATTACHMENT_MESSAGES.generateNeedsTitle).max(TASK_MAX_LENGTH, DAILY_TASKS_MESSAGES.contentTooLong)),
  parents: z.array(z.string().trim().max(TASK_MAX_LENGTH)).max(TASK_MAX_DEPTH - 1).optional().default([]),
  /**
   * What is already written, which the new text builds on. The whole box is accepted, however long
   * it has grown, because refusing it would be refusing to write about a task the user can see;
   * only the first `AI_DESCRIPTION_MAX_CHARS` of it reach the model (`writeTaskDetails`).
   */
  description: z
    .string()
    .max(DAILY_TASK_DESCRIPTION_MAX_LENGTH, TASK_ATTACHMENT_MESSAGES.descriptionTooLong(DAILY_TASK_DESCRIPTION_MAX_LENGTH))
    .optional()
    .default(""),
})
