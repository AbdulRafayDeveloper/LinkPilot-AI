import { z } from "zod"
import {
  CLIENT_PROJECT_DESCRIPTION_MAX_LENGTH,
  CLIENT_PROJECT_MESSAGES,
  CLIENT_PROJECT_NAME_MAX_LENGTH,
  CLIENT_PROJECT_STATUS_IDS,
  DEFAULT_CLIENT_PROJECT_STATUS,
} from "@/constants/clients"

/**
 * One project of a client as the API accepts it. The name is what the project is called and is
 * required; the description is what the work is and may be left empty, so a project can be added by
 * name alone and written up later.
 */
export const ClientProjectSchema = z.object({
  name: z
    .string({ error: CLIENT_PROJECT_MESSAGES.missingName })
    .trim()
    .min(1, CLIENT_PROJECT_MESSAGES.missingName)
    .max(CLIENT_PROJECT_NAME_MAX_LENGTH, CLIENT_PROJECT_MESSAGES.nameTooLong),
  description: z
    .string()
    .trim()
    .max(CLIENT_PROJECT_DESCRIPTION_MAX_LENGTH, CLIENT_PROJECT_MESSAGES.descriptionTooLong)
    .optional()
    .default(""),
  status: z
    .enum(CLIENT_PROJECT_STATUS_IDS, { error: CLIENT_PROJECT_MESSAGES.missingStatus })
    .optional()
    .default(DEFAULT_CLIENT_PROJECT_STATUS),
})
