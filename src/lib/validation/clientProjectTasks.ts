import { z } from "zod"
import {
  PROJECT_ITEM_KIND_IDS,
  PROJECT_TASK_MAX_LENGTH,
  PROJECT_TASK_MESSAGES,
  PROJECT_TASK_STATUS_IDS,
  TASK_MAX_IMAGES,
  VOICE_NOTE_MAX_SECONDS,
} from "@/constants/clientProjectTasks"
import { TASK_ATTACHMENT_MESSAGES, TASK_DESCRIPTION_MAX_LENGTH } from "@/constants/taskAttachments"

/** One image as an item names it: the id the server made for it and what it is. */
const ImageSchema = z.object({
  assetId: z.string().regex(/^[0-9a-f]{24}$/),
  contentType: z.string().max(60),
})

/** The voice note an item carries, as the upload route answered it. */
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
// Left out, the item is a change: the first tab, and what every item saved before the tabs is
const kind = z.enum(PROJECT_ITEM_KIND_IDS, { error: PROJECT_TASK_MESSAGES.badKind }).optional()

/** An item's own id, as a path or a body names it. */
const taskId = z.string().regex(/^[0-9a-f]{24}$/, PROJECT_TASK_MESSAGES.taskNotFound)

/** A new item. Everything but the line is optional, so a one-line item costs nothing to add. */
export const ProjectTaskSchema = z.object({ content, description, images, voiceNote, status, kind })

/**
 * The fields a change to an item may carry. Only the ones sent are written, so ticking an item off
 * is `{ status }` alone and never has to carry its text, images and voice note back. `kind` is not
 * among them: which tab an item belongs to is settled when it is added.
 */
const editFields = { content: content.optional(), description, images, voiceNote, status }
// Named rather than counted, so the shared link's body can carry `taskId` as well and that alone
// still reads as "nothing to change"
const EDIT_FIELDS = Object.keys(editFields)
const saysSomething = (body: Record<string, unknown>) => EDIT_FIELDS.some((name) => body[name] !== undefined)

/** A change to an item. A body with nothing in it is refused rather than saved as an empty change. */
export const ProjectTaskEditSchema = z.object(editFields).refine(saysSomething, PROJECT_TASK_MESSAGES.saveFailed)

/**
 * The same three bodies again for the shared link, which names the item in the body because the
 * token is what the path carries. They are the same fields and the same limits: whoever holds the
 * link writes exactly what the owner can write, and nothing more.
 */
export const PublicProjectTaskSchema = ProjectTaskSchema
export const PublicTaskEditSchema = z.object({ taskId, ...editFields }).refine(saysSomething, PROJECT_TASK_MESSAGES.saveFailed)
export const PublicTaskDeleteSchema = z.object({ taskId })

/** What a voice note upload says about itself; the bytes are the body and the type is read from them. */
export const VoiceUploadQuerySchema = z.object({
  seconds: z.coerce.number().min(0).max(VOICE_NOTE_MAX_SECONDS).catch(0),
})

/** Making, replacing or turning off a project's shared link. */
export const ProjectLinkSchema = z.object({
  action: z.enum(["create", "replace", "disable"], { error: PROJECT_TASK_MESSAGES.linkFailed }),
})
