import { z } from "zod"
import {
  REFERENCE_CONTENT_MAX_LENGTH,
  REFERENCE_CONTENT_MESSAGES,
  REFERENCE_TITLE_MAX_LENGTH,
} from "@/constants/referenceContent"

/**
 * One piece of reference content as the API accepts it: a name to find it by and the text itself.
 */
export const ReferenceItemSchema = z.object({
  title: z
    .string({ error: REFERENCE_CONTENT_MESSAGES.missingTitle })
    .trim()
    .min(1, REFERENCE_CONTENT_MESSAGES.missingTitle)
    .max(REFERENCE_TITLE_MAX_LENGTH, REFERENCE_CONTENT_MESSAGES.titleTooLong),
  content: z
    .string({ error: REFERENCE_CONTENT_MESSAGES.missingContent })
    .trim()
    .min(1, REFERENCE_CONTENT_MESSAGES.missingContent)
    .max(REFERENCE_CONTENT_MAX_LENGTH, REFERENCE_CONTENT_MESSAGES.contentTooLong),
})
