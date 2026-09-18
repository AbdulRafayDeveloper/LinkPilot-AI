/**
 * Projects for the Prompt Creator: the piece of work a prompt was written for. A project keeps its
 * own instruction block, which is added to the end of every prompt created in it, so a standing
 * rule ("answer in British English", "we use Next.js 16") is written once instead of every time.
 *
 * A project is not a folder (`constants/promptFolders.ts`): a folder is where a prompt is filed
 * afterwards, while a project is what it was written for and what its instructions come from.
 */

export const PROMPT_PROJECTS_ENDPOINT = "/api/prompt-creator/projects"

// A project's name is a label, not a sentence
export const PROJECT_NAME_MAX_LENGTH = 60
// The standing instructions added to every prompt created in the project
export const PROJECT_INSTRUCTIONS_MAX_LENGTH = 4000
// Enough for real work; a list longer than this is a sign of tags, not projects
export const MAX_PROJECTS = 100
// Prompts listed at once when a project's own prompts are opened
export const PROJECT_PROMPTS_PAGE_SIZE = 50

// What the picker calls working without a project
export const NO_PROJECT = "none"

export const PROMPT_PROJECT_MESSAGES = {
  missingName: "Name the project.",
  nameTooLong: `Keep the project name under ${PROJECT_NAME_MAX_LENGTH} characters.`,
  instructionsTooLong: `Keep the instructions under ${PROJECT_INSTRUCTIONS_MAX_LENGTH.toLocaleString()} characters.`,
  duplicate: "A project with that name already exists.",
  tooMany: `You can keep up to ${MAX_PROJECTS} projects.`,
  notFound: "That project no longer exists.",
  loadFailed: "Couldn't load your projects. Please try again.",
  createFailed: "Couldn't create the project. Please try again.",
  saveFailed: "Couldn't save the project. Please try again.",
  deleteFailed: "Couldn't delete the project. Please try again.",
  promptsFailed: "Couldn't load this project's prompts. Please try again.",
  // Deleting a project keeps the prompts written in it; only the project goes
  deleteExplains: "The prompts written in it are kept and go back to no project.",
  none: "No project",
  instructionsHint: "Added to the end of every prompt created in this project.",
} as const
