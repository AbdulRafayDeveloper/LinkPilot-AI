import { z } from "zod"
import { PROJECT_INSTRUCTIONS_MAX_LENGTH, PROJECT_NAME_MAX_LENGTH, PROMPT_PROJECT_MESSAGES } from "@/constants/promptProjects"

const Name = z
  .string({ error: PROMPT_PROJECT_MESSAGES.missingName })
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(1, PROMPT_PROJECT_MESSAGES.missingName).max(PROJECT_NAME_MAX_LENGTH, PROMPT_PROJECT_MESSAGES.nameTooLong))

const Instructions = z
  .string()
  .trim()
  .max(PROJECT_INSTRUCTIONS_MAX_LENGTH, PROMPT_PROJECT_MESSAGES.instructionsTooLong)

/** A new project: a name, and the standing instructions it adds to every prompt (optional). */
export const ProjectInputSchema = z.object({ name: Name, instructions: Instructions.optional().default("") })

/** A change to a project: its name, its instructions, or both. */
export const ProjectChangesSchema = z
  .object({ name: Name.optional(), instructions: Instructions.optional() })
  .refine((changes) => changes.name !== undefined || changes.instructions !== undefined, PROMPT_PROJECT_MESSAGES.saveFailed)

/** A project id, or null for a prompt written outside any project. */
export const ProjectIdSchema = z.union([z.string().regex(/^[0-9a-f]{24}$/, PROMPT_PROJECT_MESSAGES.notFound), z.null()])
