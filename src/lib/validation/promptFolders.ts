import { z } from "zod"
import { FOLDER_NAME_MAX_LENGTH, PROMPT_FOLDER_MESSAGES } from "@/constants/promptFolders"

/** A folder's name, tidied the way every other name in the app is: one space between words. */
export const FolderNameSchema = z.object({
  name: z
    .string({ error: PROMPT_FOLDER_MESSAGES.missingName })
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, PROMPT_FOLDER_MESSAGES.missingName).max(FOLDER_NAME_MAX_LENGTH, PROMPT_FOLDER_MESSAGES.nameTooLong)),
})

/** A folder id, or null for "no folder", as a prompt names where it is filed. */
export const FolderIdSchema = z.union([z.string().regex(/^[0-9a-f]{24}$/, PROMPT_FOLDER_MESSAGES.notFound), z.null()])
