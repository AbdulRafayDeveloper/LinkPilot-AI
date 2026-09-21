import { z } from "zod"
import {
  CONTENT_TEXT_SIZES,
  CONTENT_DESCRIPTION_MAX_LENGTH,
  CONTENT_NAME_MAX_LENGTH,
  CONTENT_TYPE_MAX_LENGTH,
  IMPORTANT_CONTENT_MESSAGES,
} from "@/constants/importantContent"
import { blankToEmpty, searchParam } from "./listFilters"

// One line of text: runs of spaces collapse, the ends are trimmed
const line = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value)

export const ImportantContentSchema = z.object({
  name: z.preprocess(
    line,
    z.string({ error: IMPORTANT_CONTENT_MESSAGES.missingName }).min(1, IMPORTANT_CONTENT_MESSAGES.missingName).max(CONTENT_NAME_MAX_LENGTH, IMPORTANT_CONTENT_MESSAGES.nameTooLong)
  ),
  // The description is the saved text itself, so its line breaks and spacing are kept exactly
  description: z
    .string({ error: IMPORTANT_CONTENT_MESSAGES.descriptionTooLong })
    .max(CONTENT_DESCRIPTION_MAX_LENGTH, IMPORTANT_CONTENT_MESSAGES.descriptionTooLong)
    .optional()
    .transform((value) => (value && value.trim() ? value : "")),
  type: z.preprocess(
    line,
    z.string({ error: IMPORTANT_CONTENT_MESSAGES.missingType }).min(1, IMPORTANT_CONTENT_MESSAGES.missingType).max(CONTENT_TYPE_MAX_LENGTH, IMPORTANT_CONTENT_MESSAGES.typeTooLong)
  ),
  // Optional, so a caller that never heard of sizes keeps working and leaves the size alone
  textSize: z
    .number({ error: IMPORTANT_CONTENT_MESSAGES.badTextSize })
    .refine((size) => (CONTENT_TEXT_SIZES as readonly number[]).includes(size), IMPORTANT_CONTENT_MESSAGES.badTextSize)
    .optional(),
})

export const ImportantContentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
  search: searchParam,
  // Any type the user made up, matched exactly as saved
  type: z.preprocess(blankToEmpty, z.string().max(CONTENT_TYPE_MAX_LENGTH)),
})
