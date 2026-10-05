import { FolderKanban, type LucideIcon } from "lucide-react"
import { TASK_IMAGE_MAX_BYTES, TASK_IMAGE_TYPES, TASK_MAX_IMAGES } from "./taskAttachments"
import { VOICE_MAX_BYTES, VOICE_MAX_SECONDS } from "./voiceInput"

/**
 * Client Projects: the work being done for each client, with everything that is said about it.
 *
 * The projects themselves are the ones Clients Management already keeps (`client_projects`, one
 * client's work); this module lists every client's projects in one place and gives each project its
 * own items under three tabs (Changes, Ideas, Discussion), with images and a voice note on each,
 * plus a link the client opens **and writes on** without signing in. Nothing here changes a
 * project's own fields, which Clients Management owns.
 */

export const CLIENT_PROJECTS_TOOL = {
  id: "client-projects",
  title: "Client Projects",
  description: "Every client project with its changes, ideas and discussion, and a link to share",
  href: "/client-projects",
  icon: FolderKanban as LucideIcon,
  group: "clients",
} as const

export const CLIENT_PROJECTS_ENDPOINT = "/api/client-projects"
// Where the browser sends one voice note to be stored, through the app like a task image
export const PROJECT_VOICE_ENDPOINT = "/api/client-projects/voice"
// The page a shared link opens, and the route behind it. Both take the token as the next path part,
// and the two uploads a client may make hang off that same token (see PUBLIC_UPLOAD_PATHS)
export const PUBLIC_PROJECT_PATH = "/project"
export const PUBLIC_PROJECT_ENDPOINT = "/api/public/projects"
export const PUBLIC_UPLOAD_PATHS = { images: "images", voice: "voice" } as const

/**
 * The three kinds of item a project carries, which are the tabs on both surfaces, in order. The
 * first is the default (`DEFAULT_PROJECT_ITEM_KIND` reads `PROJECT_ITEM_KINDS[0]`), so **Changes**
 * is what the owner's page and a shared link both open on, the same rule Post Comment Replies'
 * styles follow.
 *
 * They are one collection with a `kind` on each row, not three collections: an item carries the
 * same line, details, images, voice note and tick whichever tab it sits under, so one list, one
 * composer and one set of routes serve all three. A row saved before the tabs existed has no
 * `kind` and reads as a Change, which is what every task in the first version was.
 */
export const PROJECT_ITEM_KINDS = [
  {
    id: "change",
    label: "Changes",
    one: "change",
    // The composer's heading and its button, above the list
    addLabel: "Add a change",
    placeholder: "What needs changing on this project",
    // What a ticked item means here, which is also what the counter beside the tab says
    doneLabel: "done",
    empty: "No changes on this project yet. Add the first one above.",
  },
  {
    id: "idea",
    label: "Ideas",
    one: "idea",
    addLabel: "Add new idea",
    placeholder: "An idea worth trying on this project",
    doneLabel: "picked up",
    empty: "No ideas yet. Add the first one above.",
  },
  {
    id: "discussion",
    label: "Discussion",
    one: "message",
    addLabel: "Add to the discussion",
    placeholder: "Something to ask, answer or agree on",
    doneLabel: "settled",
    empty: "Nothing in the discussion yet. Start it above.",
  },
] as const

export type ProjectItemKind = (typeof PROJECT_ITEM_KINDS)[number]["id"]
export const PROJECT_ITEM_KIND_IDS = PROJECT_ITEM_KINDS.map((kind) => kind.id) as [ProjectItemKind, ...ProjectItemKind[]]
export const DEFAULT_PROJECT_ITEM_KIND: ProjectItemKind = PROJECT_ITEM_KINDS[0].id

/** One kind by its id, falling back to the default so an unknown value never leaves a page blank. */
export const projectItemKind = (id: string | null | undefined) =>
  PROJECT_ITEM_KINDS.find((kind) => kind.id === id) ?? PROJECT_ITEM_KINDS[0]

/**
 * Who put an item there: the account that owns the project, or someone writing from the shared
 * link. It is stored so both surfaces can say where an item came from, and it is decided by which
 * route the write arrived on, never by anything the browser sends.
 */
export const PROJECT_ITEM_AUTHORS = ["owner", "client"] as const
export type ProjectItemAuthor = (typeof PROJECT_ITEM_AUTHORS)[number]

// An item is one line of work, the same length an employee's plan task has
export const PROJECT_TASK_MAX_LENGTH = 900
// How many items one project may carry **per tab**, so a long discussion never crowds out the
// changes. It is also the ceiling on what anyone holding a shared link can add.
export const MAX_PROJECT_TASKS = 300

export const PROJECT_TASK_STATUSES = [
  { id: "open", label: "To do", description: "Still to be done" },
  { id: "done", label: "Done", description: "Finished" },
] as const

export type ProjectTaskStatus = (typeof PROJECT_TASK_STATUSES)[number]["id"]
export const PROJECT_TASK_STATUS_IDS = PROJECT_TASK_STATUSES.map((status) => status.id) as [ProjectTaskStatus, ...ProjectTaskStatus[]]

// The images are the shared task images, so one picker, one set of limits and one storage service
export { TASK_IMAGE_MAX_BYTES, TASK_IMAGE_TYPES, TASK_MAX_IMAGES }

/**
 * A voice note is recorded in the browser and stored as it was recorded. The ceiling is the shared
 * one (4 MB, what a serverless function takes as a body), and the clock is the shared six minutes,
 * so a note that would be refused is stopped before it is sent rather than after.
 */
export const VOICE_NOTE_MAX_BYTES = VOICE_MAX_BYTES
export const VOICE_NOTE_MAX_SECONDS = VOICE_MAX_SECONDS

export const PROJECT_TASK_MESSAGES = {
  loadFailed: "Couldn't load the projects. Please try again.",
  projectNotFound: "That project no longer exists.",
  taskNotFound: "That item no longer exists.",
  missingTask: "Write what it is.",
  taskTooLong: `Keep it under ${PROJECT_TASK_MAX_LENGTH} characters.`,
  tooManyTasks: `You can keep up to ${MAX_PROJECT_TASKS} items on one tab of a project.`,
  tooManyImages: `An item can carry up to ${TASK_MAX_IMAGES} images.`,
  badStatus: "Choose whether it is still to do or finished.",
  badKind: "Choose whether it is a change, an idea or part of the discussion.",
  saveFailed: "Couldn't save it. Please try again.",
  deleteFailed: "Couldn't remove it. Please try again.",
  created: "Added.",
  saved: "Saved.",
  deleted: "Removed.",
  deleteExplains: "It goes with its images and its voice note. This can't be undone.",
  noProjects: "No client projects yet. Add a project to a client in Clients Management, and it shows here.",
  noResults: "No project matches the search or the filters.",
  // Where an item came from, shown as a tag on the item itself
  fromClient: "From the client",
  fromOwner: "From the project owner",
  // The voice note
  voiceTooLarge: `A voice note must be ${VOICE_NOTE_MAX_BYTES / (1024 * 1024)} MB or smaller.`,
  voiceUnsupported: "That recording isn't an audio file this can store.",
  voiceFailed: "Couldn't save the voice note. Please try again.",
  voiceStorageUnavailable: "Voice notes can't be saved here yet: file storage isn't set up.",
  recording: "Recording...",
  // The shared link
  linkInvalid: "That link doesn't open anything.",
  linkFailed: "Couldn't change the link. Please try again.",
  linkExplains:
    "Anyone with this link can read this project and add, change and remove its changes, ideas and discussion, with images and voice notes, without signing in. Send it to the client; turn it off to stop it.",
  linkReplaced: "New link made. The old one stopped working.",
  linkOff: "Link turned off.",
  linkCopied: "Link copied.",
} as const

export const PUBLIC_PROJECT_MESSAGES = {
  // Every refusal about the link reads the same, so a guessed token learns nothing
  invalid: "That link doesn't open anything.",
  // On the shared page, so whoever opens it knows they may write rather than guessing
  canWrite: "You can add and change items here",
  intro: "Add what you need under any of the three tabs. Everything you add shows up for the project owner straight away.",
} as const
