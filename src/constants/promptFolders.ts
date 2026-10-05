import { folderCopy, folderMessages } from "./folders"

/**
 * Folders for the prompts the Prompt Creator writes: a prompt sits in one folder or in none, and
 * can be moved between them. The limits, the filter values and the wording are the shared ones
 * (`constants/folders.ts`, which Important Content's folders read too); only the endpoints and the
 * noun are Prompt Creator's own.
 */

export const PROMPT_FOLDERS_ENDPOINT = "/api/prompt-creator/folders"
// Where one created prompt is saved, which is also where it is filed in a folder
export const PROMPT_CREATOR_RECORD_ENDPOINT = "/api/prompt-creator/created"

export { FOLDER_NAME_MAX_LENGTH, MAX_FOLDERS, UNFILED_FOLDER, IN_ANY_FOLDER } from "./folders"

export const PROMPT_FOLDER_MESSAGES = folderMessages({ one: "prompt", many: "prompts" })

/** The words the shared folder dialogs show for prompts, which is what they show when none is passed. */
export const PROMPT_FOLDER_COPY = folderCopy({ one: "prompt", many: "prompts" })
