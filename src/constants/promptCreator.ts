import { Wand2, type LucideIcon } from "lucide-react"

/**
 * Prompt Creator target registry. Each target owns an independent, separately stored prompt
 * (prompt record: prompt-creator-<id> in the prompts collection) that decides how the
 * finished prompt is shaped. Adding a target means adding an entry here plus its prompt record.
 */
export const PROMPT_TARGETS = [
  {
    id: "editor-agent",
    label: "Cursor / Claude / Antigravity",
    shortLabel: "Coding agent",
    description: "Steps to follow, then a validation pass",
  },
  {
    id: "web-search",
    label: "ChatGPT / Gemini Search",
    shortLabel: "AI search",
    description: "Sourced research with a comparison",
  },
] as const

export type PromptTargetId = (typeof PROMPT_TARGETS)[number]["id"]

export const PROMPT_TARGET_IDS = PROMPT_TARGETS.map((target) => target.id) as [PromptTargetId, ...PromptTargetId[]]

export const DEFAULT_PROMPT_TARGET: PromptTargetId = "editor-agent"

export function getPromptTargetLabel(target: PromptTargetId): string {
  return PROMPT_TARGETS.find((entry) => entry.id === target)?.label ?? target
}

export const PROMPT_TARGET_TABS = PROMPT_TARGETS.map((target) => ({ id: target.id, label: target.shortLabel }))

// What the user describes, by voice (constants/voiceInput.ts) or by typing; room for a whole
// six-minute recording plus some typing around it
export const REQUEST_MAX_LENGTH = 12000
// The name the model writes for the prompt, and the user can rewrite
export const CREATED_NAME_MAX_LENGTH = 80
// The finished prompt
export const CREATED_PROMPT_MAX_LENGTH = 20000

/**
 * The `requestSource` of a prompt the user **added themselves** rather than had written: they
 * already had it, so there was no description to type or speak. It is a third value beside the two
 * ways a description arrives, which is what lets the history say where a prompt came from and filter
 * on it; `RequestSource` itself stays the two the generator knows (`types/promptCreator.ts`).
 */
export const ADDED_BY_HAND = "added"

// Where the description is read back in clear, simple English (it saves nothing of its own)
export const PROMPT_CREATOR_ENGLISH_PATH = "/english"

export const PROMPT_CREATOR_ENDPOINT = "/api/prompt-creator"

/**
 * The projects a prompt can be written for. **They are the clients' own projects** (Clients
 * Management, `client_projects`): this route only reads them for the picker, and a project is made,
 * renamed and deleted with its client. There used to be a separate Projects module with its own
 * list; the owner asked for one place, so this is a read of theirs.
 */
export const PROMPT_PROJECTS_ENDPOINT = "/api/prompt-creator/projects"

// What the picker calls writing a prompt for no project at all
export const NO_PROJECT = "none"

// The standing instructions live on the project, so a project's own limit is theirs
export const PROMPT_PROJECT_MESSAGES = {
  none: "No project",
  loadFailed: "Couldn't load your projects. Please try again.",
  notFound: "That project no longer exists.",
  // Under the picker, so it is clear before writing where the prompt will be kept
  filedInFolder: "Saved prompts go straight into this project's folder.",
  // Where projects are made and changed now that Prompt Creator only picks one
  manage: "Manage",
  manageHint: "Projects are added under their client in Clients Management.",
  empty: "No projects yet. Add one under its client in Clients Management.",
} as const


export const PROMPT_CREATOR_MESSAGES = {
  missingRequest: "Describe the task you want a prompt for, by typing or by speaking.",
  requestTooLong: `Your description must be under ${REQUEST_MAX_LENGTH.toLocaleString()} characters.`,
  missingTarget: "Choose what the prompt is for.",
  generationFailed: "Couldn't create the prompt. Please try again.",
  // Reading the description back in English, which is asked for rather than automatic
  englishFailed: "Couldn't read that back in English. Please try again.",
  englishHeading: "What you wrote, in English",
  englishEmpty: "Write or speak the description first, then it can be read back in English.",
  englishButton: "Read it in English",
  englishWorking: "Reading it in English...",
  englishUse: "Create the prompt from this English",
  englishStale: "You have changed the description since this was read, so read it again to see the English of what is in the box now.",
  missingName: "Give the prompt a name.",
  nameTooLong: `The name must be under ${CREATED_NAME_MAX_LENGTH} characters.`,
  emptyPrompt: "The prompt can't be empty.",
  saveFailed: "Couldn't save your changes. Please try again.",
  notFound: "That saved prompt no longer exists.",
  // Adding a prompt the user already has, rather than having one written (ADDED_BY_HAND)
  addTitle: "Add a prompt you already have",
  addHint: "Paste a prompt you wrote somewhere else. It is kept with the ones this tool writes, so it is filed, told what it waits for and marked as applied in exactly the same way.",
  addButton: "Add a prompt",
  addSave: "Save prompt",
  addSaving: "Saving...",
  addFailed: "Couldn't add that prompt. Please try again.",
  addedName: "Name it so you can find it again",
  addedPrompt: "The prompt itself",
  // Rewriting a saved prompt from the history page, where it is read rather than from the create page
  editTitle: "Edit this prompt",
  editHint:
    "Change the name you find it by, or the prompt itself. Everything else stays as it is: the folder it is filed in, what it waits for, and whether it has been applied.",
  editButton: "Edit prompt",
  editSave: "Save changes",
  editUnchanged: "Nothing has been changed yet.",
  editFailed: "Couldn't save that prompt. It is back as it was.",
} as const

// The module's sidebar entry: the first tool under Workspace, where the day's own work is kept
export const PROMPT_CREATOR_TOOL: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: "workspace"
} = {
  id: "prompt-creator",
  title: "Prompt Creator",
  description: "Turn a task into an AI prompt",
  icon: Wand2,
  href: "/prompt-creator",
  group: "workspace",
}
