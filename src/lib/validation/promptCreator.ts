import { z } from "zod"
import {
  CREATED_NAME_MAX_LENGTH,
  CREATED_PROMPT_MAX_LENGTH,
  DEFAULT_PROMPT_TARGET,
  PROMPT_CREATOR_MESSAGES,
  PROMPT_TARGET_IDS,
} from "@/constants/promptCreator"
import { FolderIdSchema } from "./promptFolders"
import { DependencyIdsSchema } from "./promptDependencies"

/**
 * A prompt the user **adds themselves**, having written it somewhere else, rather than one the
 * module writes for them. It is the same record either way (`created_prompts`), so this asks for
 * exactly what a saved prompt carries that the user can choose: its name, the prompt itself, what
 * it is for, the folder it is filed in and what it waits for.
 *
 * Only the first two are required. The target falls back to the usual default, and a prompt added
 * with no folder and nothing to wait for is simply an independent prompt in no folder, which is
 * what every prompt saved before folders and dependencies existed reads as.
 */
export const AddCreatedPromptSchema = z.object({
  name: z
    .string({ error: PROMPT_CREATOR_MESSAGES.missingName })
    .trim()
    .min(1, PROMPT_CREATOR_MESSAGES.missingName)
    .max(CREATED_NAME_MAX_LENGTH, PROMPT_CREATOR_MESSAGES.nameTooLong),
  prompt: z
    .string({ error: PROMPT_CREATOR_MESSAGES.emptyPrompt })
    .trim()
    .min(1, PROMPT_CREATOR_MESSAGES.emptyPrompt)
    .max(CREATED_PROMPT_MAX_LENGTH, "That prompt is too long to save."),
  target: z.enum(PROMPT_TARGET_IDS, { error: PROMPT_CREATOR_MESSAGES.missingTarget }).optional().default(DEFAULT_PROMPT_TARGET),
  // Where it is filed: a folder id, or null for no folder. The service checks it is the viewer's own
  folderId: FolderIdSchema.optional().default(null),
  // The prompts it waits for, in the order to work in; checked for loops and ownership in the service
  dependencyIds: DependencyIdsSchema.optional().default([]),
})

export type AddCreatedPromptInput = z.infer<typeof AddCreatedPromptSchema>
