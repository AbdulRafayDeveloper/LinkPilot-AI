/**
 * What every module's folders share: the limits, the two filter values that are not a folder id,
 * and the wording, built from the name of the thing being filed ("prompt", "entry"). A module keeps
 * only its own endpoint and its noun, so a second module's folders read and behave like the first's
 * instead of growing their own near-identical strings.
 *
 * A folder holds nothing itself: each record carries the id of the folder it is in (`folderId`, null
 * for one in no folder), so moving a record is one small write on the record, and deleting a folder
 * only frees what was filed in it.
 */

// A folder's name is a label, not a sentence
export const FOLDER_NAME_MAX_LENGTH = 60
// Enough to sort real work; a list longer than this is a sign of tags, not folders
export const MAX_FOLDERS = 100

// The filter value for records that are in no folder, and the value a picker uses for "no folder"
export const UNFILED_FOLDER = "none"
// The filter value for every record that is filed, whichever folder it is in. Neither this nor
// UNFILED_FOLDER can be mistaken for a folder, whose id is always 24 hex characters
export const IN_ANY_FOLDER = "in-folder"

// What a record in no folder is called, which is the same whatever is being filed
export const UNFILED_FOLDER_LABEL = "No folder"

/** What a module calls the thing it files, in the singular and the plural. */
export interface FolderNoun {
  one: string
  many: string
}

/**
 * Every message a module's folders need. The wording is the same everywhere, with only the noun
 * changing, so "Couldn't move the prompt" and "Couldn't move the entry" can never drift apart.
 */
export const folderMessages = (noun: FolderNoun) =>
  ({
    missingName: "Name the folder.",
    nameTooLong: `Keep the folder name under ${FOLDER_NAME_MAX_LENGTH} characters.`,
    duplicate: "A folder with that name already exists.",
    tooMany: `You can keep up to ${MAX_FOLDERS} folders.`,
    notFound: "That folder no longer exists.",
    loadFailed: "Couldn't load the folders. Please try again.",
    createFailed: "Couldn't create the folder. Please try again.",
    renameFailed: "Couldn't rename the folder. Please try again.",
    deleteFailed: "Couldn't delete the folder. Please try again.",
    moveFailed: `Couldn't move the ${noun.one}, so it is back where it was. Please try again.`,
    // Deleting a folder keeps what is filed in it; only the folder goes
    deleteExplains: `The ${noun.many} in it are kept and go back to No folder.`,
    unfiled: UNFILED_FOLDER_LABEL,
    allFolders: "All folders",
    inAnyFolder: "In a folder",
    // The search box inside the folder filter, and what it says when nothing matches
    searchFolders: "Search folders",
    noFolderMatch: "No folder matches that name.",
  }) as const

/** The words the shared folder dialogs put on screen, which name the records being filed. */
export interface FolderCopy {
  noun: FolderNoun
  // The line under the Folders dialog's title
  manage: string
  // What the Folders dialog says with no folders yet
  emptyHint: string
  deleteExplains: string
  // The fallback when a folder action fails for a reason the server didn't explain
  failed: string
  moveFailed: string
}

export const folderCopy = (noun: FolderNoun): FolderCopy => {
  const messages = folderMessages(noun)
  return {
    noun,
    manage: `Make, rename and delete the folders your ${noun.many} are filed in.`,
    emptyHint: `No folders yet. The first one can be made above, or straight from a ${noun.one}'s Move button.`,
    deleteExplains: messages.deleteExplains,
    failed: messages.createFailed,
    moveFailed: messages.moveFailed,
  }
}
