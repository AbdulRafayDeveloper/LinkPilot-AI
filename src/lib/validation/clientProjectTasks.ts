import { z } from "zod"
import {
  ASSET_MAX_BYTES,
  PROJECT_FILE_CHUNK_BYTES,
  PROJECT_FILE_MAX_CHUNKS,
  PROJECT_FILE_NAME_MAX_LENGTH,
  PROJECT_ITEM_KIND_IDS,
  PROJECT_MAX_FILES,
  PROJECT_MAX_IMAGES,
  maxBytesFor,
  PROJECT_TASK_MAX_LENGTH,
  PROJECT_TASK_MESSAGES,
  PROJECT_TASK_STATUS_IDS,
  VOICE_NOTE_MAX_SECONDS,
} from "@/constants/clientProjectTasks"
import { ASSET_CATEGORY_IDS, categoryForContentType } from "@/constants/importantFiles"
import { PROJECT_DESCRIPTION_MAX_LENGTH } from "@/constants/clientProjectTasks"

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

const description = z.string().max(PROJECT_DESCRIPTION_MAX_LENGTH, PROJECT_TASK_MESSAGES.descriptionTooLong).optional()
const images = z.array(ImageSchema).max(PROJECT_MAX_IMAGES, PROJECT_TASK_MESSAGES.tooManyImages).optional()

/**
 * One file as an item names it. Everything about it was settled when the upload was planned and
 * checked; this is only the page handing back what the finish step answered, so an id the server
 * never made, or a type it never placed, is refused here too.
 */
const FileSchema = z.object({
  assetId: z.string().regex(/^[0-9a-f]{24}$/, PROJECT_TASK_MESSAGES.fileNotFound),
  name: z.string().trim().min(1, PROJECT_TASK_MESSAGES.missingFileName).max(PROJECT_FILE_NAME_MAX_LENGTH),
  contentType: z.string().max(120),
  category: z.enum(ASSET_CATEGORY_IDS, { error: PROJECT_TASK_MESSAGES.fileUnsupported }),
  size: z.coerce.number().int().min(0).max(ASSET_MAX_BYTES),
})
const files = z.array(FileSchema).max(PROJECT_MAX_FILES, PROJECT_TASK_MESSAGES.tooManyFiles).optional()
const voiceNote = VoiceNoteSchema.nullable().optional()
const status = z.enum(PROJECT_TASK_STATUS_IDS, { error: PROJECT_TASK_MESSAGES.badStatus }).optional()
// Left out, the item is a change: the first tab, and what every item saved before the tabs is
const kind = z.enum(PROJECT_ITEM_KIND_IDS, { error: PROJECT_TASK_MESSAGES.badKind }).optional()

/** An item's own id, as a path or a body names it. */
const taskId = z.string().regex(/^[0-9a-f]{24}$/, PROJECT_TASK_MESSAGES.taskNotFound)

/** A new item. Everything but the line is optional, so a one-line item costs nothing to add. */
export const ProjectTaskSchema = z.object({ content, description, images, files, voiceNote, status, kind })

/**
 * The fields a change to an item may carry. Only the ones sent are written, so ticking an item off
 * is `{ status }` alone and never has to carry its text, images and voice note back. `kind` is not
 * among them: which tab an item belongs to is settled when it is added.
 */
const editFields = { content: content.optional(), description, images, files, voiceNote, status }
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

/**
 * What a file says about itself before it is sent. The server checks the type against the one
 * mapping and the size against that type's own ceiling, then answers how many chunks to send; the
 * browser never chooses a key, a chunk size or an id.
 */
export const ProjectFilePlanSchema = z
  .object({
    name: z.string().trim().min(1, PROJECT_TASK_MESSAGES.missingFileName).max(PROJECT_FILE_NAME_MAX_LENGTH),
    contentType: z.string().min(1, PROJECT_TASK_MESSAGES.fileUnsupported).max(120),
    size: z.coerce.number().int().positive(PROJECT_TASK_MESSAGES.fileTooLarge).max(ASSET_MAX_BYTES, PROJECT_TASK_MESSAGES.fileTooLarge),
  })
  // The ceiling is the **type's own**, not the largest any type allows: a 200 MB video is fine and a
  // 200 MB PNG is not, and that rule is here rather than only in the service, so one check decides it
  .superRefine((value, ctx) => {
    const category = categoryForContentType(value.contentType)
    if (!category) {
      ctx.addIssue({ code: "custom", message: PROJECT_TASK_MESSAGES.fileUnsupported, path: ["contentType"] })
      return
    }
    if (value.size > maxBytesFor(category)) {
      ctx.addIssue({ code: "custom", message: PROJECT_TASK_MESSAGES.fileTooLarge, path: ["size"] })
    }
  })

/** Which chunk of a file is in this request's body. */
export const ProjectFileChunkQuerySchema = z.object({
  index: z.coerce.number().int().min(0).max(PROJECT_FILE_MAX_CHUNKS - 1),
})

/** The one number a chunk's own body may be, checked before the bytes are read. */
export const PROJECT_FILE_CHUNK_CEILING = PROJECT_FILE_CHUNK_BYTES

/** What a voice note upload says about itself; the bytes are the body and the type is read from them. */
export const VoiceUploadQuerySchema = z.object({
  seconds: z.coerce.number().min(0).max(VOICE_NOTE_MAX_SECONDS).catch(0),
})

/** Making, replacing or turning off a project's shared link. */
export const ProjectLinkSchema = z.object({
  action: z.enum(["create", "replace", "disable"], { error: PROJECT_TASK_MESSAGES.linkFailed }),
})
