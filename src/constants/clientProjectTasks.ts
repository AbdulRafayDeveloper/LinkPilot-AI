import { FolderKanban, type LucideIcon } from "lucide-react"
import { TASK_IMAGE_MAX_BYTES, TASK_IMAGE_TYPES } from "./taskAttachments"
import { VOICE_MAX_BYTES } from "./voiceInput"
import { ACCEPTED_CONTENT_TYPES, ASSET_MAX_BYTES, maxBytesFor, type AssetCategoryId } from "./importantFiles"
import { MULTIPART_MIN_PART_BYTES, RECORDING_CHUNK_MAX_BYTES } from "./meetingRecording"

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
export const PUBLIC_UPLOAD_PATHS = { images: "images", voice: "voice", files: "files" } as const
// Where a signed-in page sends a file to be built up, chunk by chunk
export const PROJECT_FILES_ENDPOINT = "/api/client-projects/files"

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
/**
 * How long an item's description may be, **this module's own number** (200,000, at the owner's
 * request) rather than the shared `TASK_DESCRIPTION_MAX_LENGTH` (6,000) a daily task and an
 * employee's plan keep.
 *
 * They differ because of who reads them: a daily task's description is written and read by a model
 * (`services/dailyTasks/writeDetails.ts`), so its length is paid for by the token, while **nothing
 * on a client project is ever sent to a model** — this is a client and an owner writing to each
 * other. So it follows the "plain text boxes" rule instead and stays well under
 * `TEXT_BOX_MAX_LENGTH`, with the text going in one request rather than an autosave.
 */
export const PROJECT_DESCRIPTION_MAX_LENGTH = 200_000
/**
 * A shared link opens each item's details as it lists them, which is right for a line or two of
 * explanation and wrong for a specification: one 200,000-character description left open would bury
 * every item under it. So a description longer than this starts folded, behind its own Details
 * button, exactly as it does on the owner's page.
 */
export const PROJECT_DETAILS_OPEN_MAX_CHARS = 2_000
// How many items one project may carry **per tab**, so a long discussion never crowds out the
// changes. It is also the ceiling on what anyone holding a shared link can add.
export const MAX_PROJECT_TASKS = 300

export const PROJECT_TASK_STATUSES = [
  { id: "open", label: "To do", description: "Still to be done" },
  { id: "done", label: "Done", description: "Finished" },
] as const

export type ProjectTaskStatus = (typeof PROJECT_TASK_STATUSES)[number]["id"]
export const PROJECT_TASK_STATUS_IDS = PROJECT_TASK_STATUSES.map((status) => status.id) as [ProjectTaskStatus, ...ProjectTaskStatus[]]

// The images are the shared task images, so one picker and one storage service. **The count is this
// module's own**: an item here holds 10, at the owner's request, while a daily task and an
// employee's plan keep the shared 6 (`TASK_MAX_IMAGES`), which is what `TaskDetailsFields` still
// defaults to when nothing passes a number.
export { TASK_IMAGE_MAX_BYTES, TASK_IMAGE_TYPES }
export const PROJECT_MAX_IMAGES = 10

/**
 * Files on an item: a Word document, a PDF, a video, anything the app can place. The **types and
 * the per-type ceilings are Important Files'** (`ACCEPTED_CONTENT_TYPES`, `maxBytesFor`), so there
 * is one mapping from a content type to what it is and how big it may be, rather than a second list
 * here that could drift from it: images and text 25 MB, PDF and Word 100 MB, audio 200 MB, video
 * 500 MB.
 *
 * **A file is sent in 4 MB chunks through the app, and the server joins them**, which is how a
 * 200 MB video gets uploaded at all: a serverless request body is capped at 4.5 MB, and the
 * bucket's CORS rule refuses browser uploads straight to storage from the live site (see Important
 * Files). It is the same two numbers and the same joining a meeting recording uses, reused rather
 * than restated: 4 MB a chunk, and S3's own 5 MiB minimum for a part of a joined object.
 */
export { ACCEPTED_CONTENT_TYPES, ASSET_MAX_BYTES, maxBytesFor }
export type ProjectFileCategory = AssetCategoryId
export const PROJECT_FILE_CHUNK_BYTES = RECORDING_CHUNK_MAX_BYTES
export const PROJECT_FILE_PART_BYTES = MULTIPART_MIN_PART_BYTES
export const PROJECT_MAX_FILES = 10
// A file name is shown and is what a download is saved as; the key is built from an id, never this
export const PROJECT_FILE_NAME_MAX_LENGTH = 200
// How many chunks one upload may be, which is the ceiling in chunks rather than in bytes
export const PROJECT_FILE_MAX_CHUNKS = Math.ceil(ASSET_MAX_BYTES / RECORDING_CHUNK_MAX_BYTES)
// An upload nobody finished is forgotten after this, with its chunks
export const PROJECT_FILE_UPLOAD_HOURS = 24

/**
 * A voice note is recorded in the browser and stored as it was recorded. The ceiling is the shared
 * one (4 MB, what a serverless function takes as a body), and a note that would be refused is
 * stopped before it is sent rather than after.
 *
 * **Fifteen minutes, at the owner's request**, which is its own clock rather than the shared six
 * minutes the transcription recorder uses (`VOICE_MAX_SECONDS`): that one is cut into parts and sent
 * to a model, while this one is one request that stores the recording itself.
 *
 * Fifteen minutes only fits in 4 MB because the recording asks for a **speech bitrate**. Left to
 * the browser's own default a quarter of an hour would be several megabytes and the host would
 * refuse the request before the route ran, so the two numbers belong together: 900 seconds at
 * 24 kbps is about 2.6 MiB, a third under the ceiling, and Opus is built to carry speech at that
 * rate. `tests/clientProjectTasks.test.mjs` fails if raising one of them outgrows the other.
 */
export const VOICE_NOTE_MAX_BYTES = VOICE_MAX_BYTES
export const VOICE_NOTE_MAX_SECONDS = 15 * 60
export const VOICE_NOTE_BITS_A_SECOND = 24_000
// The last stretch of the clock, shown in red, so a long recording does not end without warning
export const VOICE_NOTE_WARN_SECONDS = 60

export const PROJECT_TASK_MESSAGES = {
  loadFailed: "Couldn't load the projects. Please try again.",
  projectNotFound: "That project no longer exists.",
  taskNotFound: "That item no longer exists.",
  missingTask: "Write what it is.",
  taskTooLong: `Keep it under ${PROJECT_TASK_MAX_LENGTH} characters.`,
  descriptionTooLong: `Keep the description under ${PROJECT_DESCRIPTION_MAX_LENGTH.toLocaleString()} characters.`,
  tooManyTasks: `You can keep up to ${MAX_PROJECT_TASKS} items on one tab of a project.`,
  tooManyImages: `An item can carry up to ${PROJECT_MAX_IMAGES} images.`,
  tooManyFiles: `An item can carry up to ${PROJECT_MAX_FILES} files.`,
  // The files
  missingFileName: "That file has no name.",
  fileUnsupported: "That file type can't be attached. Images, PDF, Word, text, video and audio can.",
  fileTooLarge: "That file is larger than this type allows.",
  fileUploadFailed: "Couldn't upload that file. Please try again.",
  fileChunkFailed: "That upload stopped part way. Try it again.",
  fileNotFound: "That file is no longer here.",
  fileStorageUnavailable: "Files can't be attached here yet: file storage isn't set up.",
  filesUploading: "Wait for the files to finish uploading.",
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
