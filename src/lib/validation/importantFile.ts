import { z } from "zod"
import {
  ASSET_DESCRIPTION_MAX_LENGTH,
  ASSET_MAX_BYTES,
  ASSET_NAME_MAX_LENGTH,
  IMPORTANT_FILES_MESSAGES,
} from "@/constants/importantFiles"

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
 * What the page tells the server before it starts uploading. The type and the size decide
 * whether the file is accepted at all, and they are checked again against S3 once it lands.
 * The storage key is never part of this: the server builds it.
 */
export const UploadRequestSchema = AssetMetadataSchema.extend({
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
