/**
 * Folders for the prompts the Prompt Creator writes: a prompt sits in one folder or in none, and
 * can be moved between them. Only Prompt Creator has folders, so everything about them lives here
 * rather than in the shared saved-outputs registry.
 */

export const PROMPT_FOLDERS_ENDPOINT = "/api/prompt-creator/folders"
// Where one created prompt is saved, which is also where it is filed in a folder
export const PROMPT_CREATOR_RECORD_ENDPOINT = "/api/prompt-creator/created"

// A folder's name is a label, not a sentence
export const FOLDER_NAME_MAX_LENGTH = 60
// Enough to sort real work; a list longer than this is a sign of tags, not folders
export const MAX_FOLDERS = 100

// The filter value for prompts that are in no folder, and the value the picker uses for "no folder"
export const UNFILED_FOLDER = "none"
// The filter value for every prompt that is filed, whichever folder it is in. Neither this nor
// UNFILED_FOLDER can be mistaken for a folder, whose id is always 24 hex characters
export const IN_ANY_FOLDER = "in-folder"

export const PROMPT_FOLDER_MESSAGES = {
  missingName: "Name the folder.",
  nameTooLong: `Keep the folder name under ${FOLDER_NAME_MAX_LENGTH} characters.`,
  duplicate: "A folder with that name already exists.",
  tooMany: `You can keep up to ${MAX_FOLDERS} folders.`,
  notFound: "That folder no longer exists.",
  loadFailed: "Couldn't load the folders. Please try again.",
  createFailed: "Couldn't create the folder. Please try again.",
  renameFailed: "Couldn't rename the folder. Please try again.",
  deleteFailed: "Couldn't delete the folder. Please try again.",
  moveFailed: "Couldn't move the prompt, so it is back where it was. Please try again.",
  // Deleting a folder keeps the prompts in it; only the folder goes
  deleteExplains: "The prompts in it are kept and go back to No folder.",
  unfiled: "No folder",
  allFolders: "All folders",
  inAnyFolder: "In a folder",
  // The search box inside the folder filter, and what it says when nothing matches
  searchFolders: "Search folders",
  noFolderMatch: "No folder matches that name.",
} as const
