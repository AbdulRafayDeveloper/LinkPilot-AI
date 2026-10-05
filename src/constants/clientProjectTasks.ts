import { FolderKanban, type LucideIcon } from "lucide-react"
import { TASK_IMAGE_MAX_BYTES, TASK_IMAGE_TYPES, TASK_MAX_IMAGES } from "./taskAttachments"
import { VOICE_MAX_BYTES, VOICE_MAX_SECONDS } from "./voiceInput"

/**
 * Client Projects: the work being done for each client, with the tasks under it.
 *
 * The projects themselves are the ones Clients Management already keeps (`client_projects`, one
 * client's work); this module lists every client's projects in one place and gives each project its
 * own tasks, with images and a voice note, plus a link that shows the project read only to someone
 * who is not signed in. Nothing here changes a project's own fields, which Clients Management owns.
 */

export const CLIENT_PROJECTS_TOOL = {
  id: "client-projects",
  title: "Client Projects",
  description: "Every client project with its tasks, images, voice notes and a link to share",
  href: "/client-projects",
  icon: FolderKanban as LucideIcon,
  group: "clients",
} as const

export const CLIENT_PROJECTS_ENDPOINT = "/api/client-projects"
// Where the browser sends one voice note to be stored, through the app like a task image
export const PROJECT_VOICE_ENDPOINT = "/api/client-projects/voice"
// The read-only page a public link opens, and the route behind it
export const PUBLIC_PROJECT_PATH = "/project"
export const PUBLIC_PROJECT_ENDPOINT = "/api/public/projects"

// A task is one line of work, the same length an employee's plan task has
export const PROJECT_TASK_MAX_LENGTH = 900
// How many tasks one project may carry, enough for real work without a page that never ends
export const MAX_PROJECT_TASKS = 300

export const PROJECT_TASK_STATUSES = [
  { id: "open", label: "To do", description: "Still to be done" },
  { id: "done", label: "Done", description: "Finished" },
] as const

export type ProjectTaskStatus = (typeof PROJECT_TASK_STATUSES)[number]["id"]
export const PROJECT_TASK_STATUS_IDS = PROJECT_TASK_STATUSES.map((status) => status.id) as [ProjectTaskStatus, ...ProjectTaskStatus[]]

// The images are the shared task images, so one picker, one route and one set of limits
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
  taskNotFound: "That task no longer exists.",
  missingTask: "Write what the task is.",
  taskTooLong: `A task must be under ${PROJECT_TASK_MAX_LENGTH} characters.`,
  tooManyTasks: `You can keep up to ${MAX_PROJECT_TASKS} tasks on one project.`,
  tooManyImages: `A task can carry up to ${TASK_MAX_IMAGES} images.`,
  badStatus: "Choose whether the task is to do or done.",
  saveFailed: "Couldn't save the task. Please try again.",
  deleteFailed: "Couldn't remove the task. Please try again.",
  created: "Task added.",
  saved: "Task saved.",
  deleted: "Task removed.",
  deleteExplains: "The task, its images and its voice note go. This can't be undone.",
  empty: "No tasks on this project yet. Add the first one above.",
  noProjects: "No client projects yet. Add a project to a client in Clients Management, and it shows here.",
  noResults: "No project matches the search or the filters.",
  // The voice note
  voiceTooLarge: `A voice note must be ${VOICE_NOTE_MAX_BYTES / (1024 * 1024)} MB or smaller.`,
  voiceUnsupported: "That recording isn't an audio file this can store.",
  voiceFailed: "Couldn't save the voice note. Please try again.",
  voiceStorageUnavailable: "Voice notes can't be saved here yet: file storage isn't set up.",
  recording: "Recording...",
  // The public link
  linkInvalid: "That link doesn't open anything.",
  linkFailed: "Couldn't change the link. Please try again.",
  linkExplains: "Anyone with this link can read this project, its tasks, their images and their voice notes. They cannot change anything.",
  linkReplaced: "New link made. The old one stopped working.",
  linkOff: "Link turned off.",
  linkCopied: "Link copied.",
} as const

export const PUBLIC_PROJECT_MESSAGES = {
  // Every refusal about the link reads the same, so a guessed token learns nothing
  invalid: "That link doesn't open anything.",
  readOnly: "This is a read-only view of the project.",
  noTasks: "No tasks on this project yet.",
} as const
