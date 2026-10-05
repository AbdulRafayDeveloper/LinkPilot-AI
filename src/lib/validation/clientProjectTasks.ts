import { z } from "zod"
import {
  PROJECT_TASK_MAX_LENGTH,
  PROJECT_TASK_MESSAGES,
  PROJECT_TASK_STATUS_IDS,
  TASK_MAX_IMAGES,
  VOICE_NOTE_MAX_SECONDS,
} from "@/constants/clientProjectTasks"
import { TASK_ATTACHMENT_MESSAGES, TASK_DESCRIPTION_MAX_LENGTH } from "@/constants/taskAttachments"

/** One image as a task names it: the id the server made for it and what it is. */
const ImageSchema = z.object({
  assetId: z.string().regex(/^[0-9a-f]{24}$/),
  contentType: z.string().max(60),
})

/** The voice note a task carries, as the upload route answered it. */
const VoiceNoteSchema = z.object({
  assetId: z.string().regex(/^[0-9a-f]{24}$/, PROJECT_TASK_MESSAGES.voiceUnsupported),
  contentType: z.string().max(60),
  seconds: z.coerce.number().min(0).max(VOICE_NOTE_MAX_SECONDS).catch(0),
})

const content = z
  .string({ error: PROJECT_TASK_MESSAGES.missingTask })
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(1, PROJECT_TASK_MESSAGES.missingTask).max(PROJECT_TASK_MAX_LENGTH, PROJECT_TASK_MESSAGES.taskTooLong))

const description = z.string().max(TASK_DESCRIPTION_MAX_LENGTH, TASK_ATTACHMENT_MESSAGES.descriptionTooLong).optional()
const images = z.array(ImageSchema).max(TASK_MAX_IMAGES, PROJECT_TASK_MESSAGES.tooManyImages).optional()
const voiceNote = VoiceNoteSchema.nullable().optional()
const status = z.enum(PROJECT_TASK_STATUS_IDS, { error: PROJECT_TASK_MESSAGES.badStatus }).optional()

/** A new task. Everything but the line is optional, so a one-line task costs nothing to add. */
export const ProjectTaskSchema = z.object({ content, description, images, voiceNote, status })

/**
 * A change to a task: only the fields sent are written, so ticking one off never has to carry its
 * text, images and voice note back, and a body with nothing in it is refused rather than saved.
 */
export const ProjectTaskEditSchema = z
  .object({ content: content.optional(), description, images, voiceNote, status })
  .refine((body) => Object.values(body).some((value) => value !== undefined), PROJECT_TASK_MESSAGES.saveFailed)

/** What a voice note upload says about itself; the bytes are the body and the type is read from them. */
export const VoiceUploadQuerySchema = z.object({
  seconds: z.coerce.number().min(0).max(VOICE_NOTE_MAX_SECONDS).catch(0),
})

/** Making, replacing or turning off a project's read-only link. */
export const ProjectLinkSchema = z.object({
  action: z.enum(["create", "replace", "disable"], { error: PROJECT_TASK_MESSAGES.linkFailed }),
})
