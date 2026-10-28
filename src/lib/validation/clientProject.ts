import { z } from "zod"
import {
  CLIENT_PROJECT_DESCRIPTION_MAX_LENGTH,
  CLIENT_PROJECT_INSTRUCTIONS_MAX_LENGTH,
  CLIENT_PROJECT_MESSAGES,
  CLIENT_PROJECT_NAME_MAX_LENGTH,
  CLIENT_PROJECT_STATUS_IDS,
  DEFAULT_CLIENT_PROJECT_STATUS,
  MAX_CLIENT_PROJECTS,
} from "@/constants/clients"

/**
 * One project of a client as the API accepts it. The name is what the project is called and is
 * required; the description is what the work is and may be left empty, so a project can be added by
 * name alone and written up later.
 */
export const ClientProjectSchema = z.object({
  /**
   * A project's name is a label, so the spaces inside it are tidied to one, the way the deleted
   * Projects module tidied its own: a project is picked from a list by name, and "Clinic   app"
   * reading differently from "Clinic app" in that list is a trap rather than a choice.
   */
  name: z
    .string({ error: CLIENT_PROJECT_MESSAGES.missingName })
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(1, CLIENT_PROJECT_MESSAGES.missingName)
        .max(CLIENT_PROJECT_NAME_MAX_LENGTH, CLIENT_PROJECT_MESSAGES.nameTooLong)
    ),
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
  /**
   * The standing instructions every Prompt Creator prompt written for this project ends with.
   * **Left out, the project keeps whatever it has**, so a caller written before projects carried
   * them (and the Client Projects module, which only ever sends the three fields) never clears
   * them; sent empty, they are cleared on purpose.
   */
  promptInstructions: z
    .string()
    .trim()
    .max(CLIENT_PROJECT_INSTRUCTIONS_MAX_LENGTH, CLIENT_PROJECT_MESSAGES.instructionsTooLong)
    .optional(),
})

/**
 * A project id as a prompt names the project it was written for, or null for a prompt written
 * outside any project. It is a client project's id (`client_projects`): Prompt Creator picks from
 * the clients' own projects, and the separate Projects module is gone.
 */
export const ProjectIdSchema = z.union([
  z.string().regex(/^[0-9a-f]{24}$/, CLIENT_PROJECT_MESSAGES.notFound),
  z.null(),
])

/** A client's projects in their new order after a drag, every one of them, top to bottom, each once. */
export const ClientProjectOrderSchema = z.object({
  orderedIds: z
    .array(z.string().regex(/^[0-9a-f]{24}$/, CLIENT_PROJECT_MESSAGES.orderChanged))
    .min(1, CLIENT_PROJECT_MESSAGES.orderChanged)
    .max(MAX_CLIENT_PROJECTS, CLIENT_PROJECT_MESSAGES.orderChanged)
    .refine((ids) => new Set(ids).size === ids.length, CLIENT_PROJECT_MESSAGES.orderChanged),
})
