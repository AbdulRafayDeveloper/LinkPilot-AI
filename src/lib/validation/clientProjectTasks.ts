import { z } from "zod"
import {
  ASSET_MAX_BYTES,
  DEFAULT_PROJECT_ITEM_KIND,
  PROJECT_URL_MAX_LENGTH,
  PUBLIC_ITEM_KIND_IDS,
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
  FOLDERED_ITEM_KINDS,
  PROJECT_FOLDER_MESSAGES,
  PROJECT_FOLDER_NAME_MAX_LENGTH,
  PROJECT_DOCUMENT_NAME_MAX_LENGTH,
  PROJECT_DOCUMENT_TEXT_MAX_LENGTH,
} from "@/constants/clientProjectTasks"
import { ASSET_CATEGORY_IDS, categoryForContentType } from "@/constants/importantFiles"
import { PROJECT_DESCRIPTION_MAX_LENGTH, type ProjectItemKind } from "@/constants/clientProjectTasks"
import { itemName, itemProblem, projectItemUrl } from "@/lib/projectItems"

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

/**
 * The line an item is named by. It is **not** required here, because a document and a backup may be
 * added with nothing typed and take their file's own name; what each kind really needs is one rule
 * (`itemProblem`), asked once below, so the message always says what is missing on that tab.
 */
const content = z
  .string({ error: PROJECT_TASK_MESSAGES.missingTask })
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(z.string().max(PROJECT_TASK_MAX_LENGTH, PROJECT_TASK_MESSAGES.taskTooLong))

/** A link item's web address. What it must be is `itemProblem`'s to say, so this only caps it. */
const url = z.string().trim().max(PROJECT_URL_MAX_LENGTH, PROJECT_TASK_MESSAGES.badUrl).optional()

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

/** An item's own id, as a path or a body names it. */
const taskId = z.string().regex(/^[0-9a-f]{24}$/, PROJECT_TASK_MESSAGES.taskNotFound)

const itemFields = { content: content.optional(), description, url, images, files, voiceNote, status }

/**
 * A new item, on the tabs the surface allows. The owner's page may write any tab; a shared link may
 * only write a public one, so **its schema takes only those kinds** and a body naming Credentials
 * or Backups is refused before anything else is read.
 *
 * What each tab needs is asked once, through the same `itemProblem` the composer asks, and the
 * answer is tidied the same way it will be stored: the line taken from the file where a tab allows
 * that, and the address given its scheme.
 */
const newItemSchema = (kinds: readonly [ProjectItemKind, ...ProjectItemKind[]]) =>
  z
    .object({ ...itemFields, kind: z.enum(kinds, { error: PROJECT_TASK_MESSAGES.badKind }).optional() })
    .superRefine((value, ctx) => {
      const problem = itemProblem(value.kind ?? DEFAULT_PROJECT_ITEM_KIND, {
        content: value.content ?? "",
        description: value.description,
        url: value.url,
        files: value.files,
      })
      if (problem) ctx.addIssue({ code: "custom", message: problem })
    })
    .transform((value) => ({
      ...value,
      content: itemName(value.kind ?? DEFAULT_PROJECT_ITEM_KIND, value.content ?? "", value.files ?? []),
      url: projectItemUrl(value.url ?? ""),
    }))

/** A new item on the owner's page: any tab, and what that tab needs. */
export const ProjectTaskSchema = newItemSchema(PROJECT_ITEM_KIND_IDS)

/**
 * The fields a change to an item may carry. Only the ones sent are written, so ticking an item off
 * is `{ status }` alone and never has to carry its text, images and voice note back. `kind` is not
 * among them: which tab an item belongs to is settled when it is added.
 */
const editFields = {
  content: content.optional(),
  description,
  url,
  images,
  files,
  voiceNote,
  status,
  // Where it is filed. Left out, the item is not moved; null moves it to the top of the tree
  folderId: z.union([z.string().regex(/^[0-9a-f]{24}$/), z.null()]).optional(),
}
// Named rather than counted, so the shared link's body can carry `taskId` as well and that alone
// still reads as "nothing to change"
const EDIT_FIELDS = Object.keys(editFields)
const saysSomething = (body: Record<string, unknown>) => EDIT_FIELDS.some((name) => body[name] !== undefined)

/** A change to an item. A body with nothing in it is refused rather than saved as an empty change. */
export const ProjectTaskEditSchema = z.object(editFields).refine(saysSomething, PROJECT_TASK_MESSAGES.saveFailed)

/**
 * The same three bodies again for the shared link, which names the item in the body because the
 * token is what the path carries. The fields and the limits are the owner's, with **one narrower
 * rule**: only a public tab may be named, so credentials and backups cannot be written from a link
 * even by a caller writing the body by hand.
 */
export const PublicProjectTaskSchema = newItemSchema(PUBLIC_ITEM_KIND_IDS)
export const PublicTaskEditSchema = z.object({ taskId, ...editFields }).refine(saysSomething, PROJECT_TASK_MESSAGES.saveFailed)
export const PublicTaskDeleteSchema = z.object({ taskId })

/**
 * What a file says about itself before it is sent. The server checks the type against the one
 * mapping and the size against that type's own ceiling, then answers how many chunks to send; the
 * browser never chooses a key, a chunk size or an id.
 */
const FOLDER_ID = z.string().regex(/^[0-9a-f]{24}$/, PROJECT_FOLDER_MESSAGES.notFound)

/** Where an item is filed: a folder of this project, or null for the top of the tree. */
export const ProjectFolderIdSchema = z.union([FOLDER_ID, z.null()])

const FolderName = z
  .string({ error: PROJECT_FOLDER_MESSAGES.missingName })
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(1, PROJECT_FOLDER_MESSAGES.missingName)
      .max(PROJECT_FOLDER_NAME_MAX_LENGTH, PROJECT_FOLDER_MESSAGES.nameTooLong)
  )

/** A new folder: which tab it files, its name, and the folder it sits in (none for the top). */
export const ProjectFolderSchema = z.object({
  kind: z.enum(FOLDERED_ITEM_KINDS, { error: PROJECT_FOLDER_MESSAGES.notFound }),
  name: FolderName,
  parentId: ProjectFolderIdSchema.optional().transform((value) => value ?? null),
})

/** A change to a folder: its name, where it sits, or both. One that says nothing is refused. */
export const ProjectFolderChangeSchema = z
  .object({ name: FolderName.optional(), parentId: ProjectFolderIdSchema.optional() })
  .refine((body) => body.name !== undefined || body.parentId !== undefined, PROJECT_FOLDER_MESSAGES.renameFailed)

/** A document written in the app: its name, what it says, and where to file it. */
export const ProjectDocumentSchema = z.object({
  name: z
    .string({ error: PROJECT_FOLDER_MESSAGES.writeMissingName })
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(1, PROJECT_FOLDER_MESSAGES.writeMissingName)
        .max(PROJECT_DOCUMENT_NAME_MAX_LENGTH, PROJECT_FOLDER_MESSAGES.nameTooLong)
    ),
  /**
   * What the document says, kept **exactly as it was typed**: its spacing and its line breaks are
   * the document. Only the check for an empty one looks past the whitespace, so a file of nothing
   * but spaces is refused while a file that happens to start with them is not changed.
   */
  text: z
    .string({ error: PROJECT_FOLDER_MESSAGES.writeMissingText })
    .max(PROJECT_DOCUMENT_TEXT_MAX_LENGTH, PROJECT_TASK_MESSAGES.descriptionTooLong)
    .refine((value) => value.trim().length > 0, PROJECT_FOLDER_MESSAGES.writeMissingText),
  folderId: ProjectFolderIdSchema.optional().transform((value) => value ?? null),
})

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
