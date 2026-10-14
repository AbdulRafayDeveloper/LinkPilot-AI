import { z } from "zod"
import {
  ASSET_DESCRIPTION_MAX_LENGTH,
  ASSET_MAX_BYTES,
  ASSET_NAME_MAX_LENGTH,
  DRIVE_FOLDER_MESSAGES,
  DRIVE_FOLDER_NAME_MAX_LENGTH,
  IMPORTANT_FILES_MESSAGES,
} from "@/constants/importantFiles"

/** A folder of the drive, or null for the top of it, as a file names where it is filed. */
export const DriveFolderIdSchema = z.union([
  z.string().regex(/^[0-9a-f]{24}$/, DRIVE_FOLDER_MESSAGES.notFound),
  z.null(),
])

/** A folder's name, tidied the way every other name in the app is: one space between words. */
const folderName = z
  .string({ error: DRIVE_FOLDER_MESSAGES.missingName })
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(1, DRIVE_FOLDER_MESSAGES.missingName).max(DRIVE_FOLDER_NAME_MAX_LENGTH, DRIVE_FOLDER_MESSAGES.nameTooLong))

/** Making a folder, at the top of the drive or inside another. */
export const DriveFolderSchema = z.object({
  name: folderName,
  parentId: DriveFolderIdSchema.optional(),
})

/** Renaming a folder, moving it under another, or both; a body that says neither is refused. */
export const DriveFolderChangeSchema = z
  .object({
    name: folderName.optional(),
    parentId: DriveFolderIdSchema.optional(),
  })
  .refine((value) => value.name !== undefined || value.parentId !== undefined, {
    message: DRIVE_FOLDER_MESSAGES.missingName,
  })

/** Filing several files in one folder at once: the picked ones, or the one dragged onto a folder. */
export const MoveAssetsSchema = z.object({
  ids: z.array(z.string().regex(/^[0-9a-f]{24}$/, IMPORTANT_FILES_MESSAGES.notFound)).min(1, IMPORTANT_FILES_MESSAGES.notFound),
  folderId: DriveFolderIdSchema,
})

/**
 * What the user can type about a file. The name is theirs to choose and has nothing to do with
 * the file's own name, so a photo called IMG_8821.jpg can be saved as "Passport scan".
 */
export const AssetMetadataSchema = z.object({
  name: z
    .string({ error: IMPORTANT_FILES_MESSAGES.missingName })
    .trim()
    .min(1, IMPORTANT_FILES_MESSAGES.missingName)
    .max(ASSET_NAME_MAX_LENGTH, IMPORTANT_FILES_MESSAGES.nameTooLong),
  description: z
    .string()
    .trim()
    .max(ASSET_DESCRIPTION_MAX_LENGTH, IMPORTANT_FILES_MESSAGES.descriptionTooLong)
    .optional()
    .default(""),
})

/**
 * An edit of one file: what the user typed, which folder it is in, or both. **Every field is
 * optional**, so moving a file is a body of `{ folderId }` alone and never carries a stale name back
 * over what another tab has saved, which is how Important Content's entries are filed too. A body
 * that says nothing at all is refused rather than counting as an empty change.
 */
export const AssetChangeSchema = z
  .object({
    name: AssetMetadataSchema.shape.name.optional(),
    description: z
      .string()
      .trim()
      .max(ASSET_DESCRIPTION_MAX_LENGTH, IMPORTANT_FILES_MESSAGES.descriptionTooLong)
      .optional(),
    folderId: DriveFolderIdSchema.optional(),
  })
  .refine((value) => value.name !== undefined || value.description !== undefined || value.folderId !== undefined, {
    message: IMPORTANT_FILES_MESSAGES.missingName,
  })

/**
 * What the page tells the server before it starts uploading. The type and the size decide
 * whether the file is accepted at all, and they are checked again against S3 once it lands.
 * The storage key is never part of this: the server builds it.
 */
export const UploadRequestSchema = AssetMetadataSchema.extend({
  // Where it goes; left out, the file lands at the top of the drive, as every file did before folders
  folderId: DriveFolderIdSchema.optional(),
  originalName: z
    .string({ error: IMPORTANT_FILES_MESSAGES.missingFile })
    .trim()
    .min(1, IMPORTANT_FILES_MESSAGES.missingFile)
    .max(255, IMPORTANT_FILES_MESSAGES.missingFile),
  contentType: z
    .string({ error: IMPORTANT_FILES_MESSAGES.unsupportedType })
    .trim()
    .min(1, IMPORTANT_FILES_MESSAGES.unsupportedType)
    .max(120, IMPORTANT_FILES_MESSAGES.unsupportedType),
  size: z
    .number({ error: IMPORTANT_FILES_MESSAGES.missingFile })
    .int()
    .positive(IMPORTANT_FILES_MESSAGES.missingFile)
    .max(ASSET_MAX_BYTES, IMPORTANT_FILES_MESSAGES.tooLarge),
})
