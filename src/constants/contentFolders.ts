import { folderCopy, folderMessages } from "./folders"

/**
 * Folders for Important Content: an entry sits in one folder or in none, and can be moved between
 * them, exactly as a created prompt can. The limits, the filter values and the wording are the
 * shared ones (`constants/folders.ts`), so the two read the same; only the endpoint and the noun
 * are Important Content's own, and the folders themselves are a separate list (`content_folders`),
 * never Prompt Creator's.
 */

export const CONTENT_FOLDERS_ENDPOINT = "/api/important-content/folders"

export { FOLDER_NAME_MAX_LENGTH, MAX_FOLDERS, UNFILED_FOLDER, IN_ANY_FOLDER } from "./folders"

export const CONTENT_FOLDER_MESSAGES = folderMessages({ one: "entry", many: "entries" })

/** The words the shared folder dialogs show for Important Content's entries. */
export const CONTENT_FOLDER_COPY = folderCopy({ one: "entry", many: "entries" })
