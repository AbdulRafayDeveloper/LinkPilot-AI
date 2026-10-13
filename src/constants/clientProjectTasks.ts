import { FolderKanban, type LucideIcon } from "lucide-react"
import { TASK_IMAGE_MAX_BYTES, TASK_IMAGE_TYPES } from "./taskAttachments"
import { VOICE_MAX_BYTES } from "./voiceInput"
import { ACCEPTED_CONTENT_TYPES, ASSET_MAX_BYTES, maxBytesFor, type AssetCategoryId } from "./importantFiles"
import { MULTIPART_MIN_PART_BYTES, RECORDING_CHUNK_MAX_BYTES } from "./meetingRecording"
import { TEXT_BOX_MAX_LENGTH } from "./textLimits"

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
  // Renamed at the owner's request; the id stays, since it is the feature switch and the SEO key
  title: "Projects Management",
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
 * What an item of one kind carries, so **one composer and one list serve every tab** rather than a
 * form per tab. A tab says which pieces it has and both surfaces render it from that, which is why
 * adding a tab is an entry in `PROJECT_ITEM_KINDS` and nothing else.
 */
export interface ProjectItemShape {
  // The written block under the line: what it is called, the hint inside it, and whether it is needed
  text: { label: string; hint: string; required: boolean } | null
  // A web address, which a link has and nothing else does
  url: boolean
  // Images and a voice note, which the three kinds of conversation carry
  talk: boolean
  // Files: not at all, by choice, or at least one (a document and a backup are a file)
  files: "none" | "optional" | "required"
  // A checkbox, which only work that can be finished has
  tick: boolean
  // Numbered and dated, newest first: what a list of backups has to be
  numbered: boolean
  // The line may be left empty and is taken from the file, which is how a backup is usually saved
  nameFromFile: boolean
}

// A change, an idea and a message all carry the same pieces, so they share one shape
const TALK: ProjectItemShape = {
  text: { label: "Description", hint: "Anything worth saying about it", required: false },
  url: false,
  talk: true,
  files: "optional",
  tick: true,
  numbered: false,
  nameFromFile: false,
}
// A note beside a link, a document or a backup: never needed, always allowed
const NOTE = { label: "Note", hint: "Anything worth saying about it", required: false }

/**
 * The kinds of item a project carries, which are the tabs on both surfaces, in order. The first is
 * the default (`DEFAULT_PROJECT_ITEM_KIND` reads `PROJECT_ITEM_KINDS[0]`), so **Changes** is what
 * the owner's page and a shared link both open on, the same rule Post Comment Replies' styles
 * follow.
 *
 * They are one collection with a `kind` on each row, never a collection per tab: an item carries
 * the same fields whichever tab it sits under, and `shape` says which of them that tab uses, so one
 * list, one composer and one set of routes serve all of them. A row saved before the tabs existed
 * has no `kind` and reads as a Change, which is what every task in the first version was.
 *
 * **`isPublic` is the whole of what a shared link may ever show.** Credentials and Backups are the
 * owner's own, and that is held in three places rather than one: the link's page lists only the
 * public tabs, the service reads only public kinds, and its routes refuse to write or change
 * anything else. So a client holding the link can neither see nor reach either of them.
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
    isPublic: true,
    shape: TALK,
  },
  {
    id: "idea",
    label: "Ideas",
    one: "idea",
    addLabel: "Add new idea",
    placeholder: "An idea worth trying on this project",
    doneLabel: "picked up",
    empty: "No ideas yet. Add the first one above.",
    isPublic: true,
    shape: TALK,
  },
  {
    id: "discussion",
    label: "Discussion",
    one: "message",
    addLabel: "Add to the discussion",
    placeholder: "Something to ask, answer or agree on",
    doneLabel: "settled",
    empty: "Nothing in the discussion yet. Start it above.",
    isPublic: true,
    shape: TALK,
  },
  {
    // The owner's own: a sign-in, a key, a panel. Never on the shared link
    id: "credentials",
    label: "Credentials",
    one: "credential",
    addLabel: "Add credentials",
    placeholder: "What these are for (the hosting panel, the database, the mail account)",
    doneLabel: "done",
    empty: "No credentials kept on this project yet. Add the first one above.",
    isPublic: false,
    shape: {
      text: { label: "Credentials", hint: "The address, the user name, the password, whatever is needed to sign in", required: true },
      url: false,
      talk: false,
      files: "none",
      tick: false,
      numbered: false,
      nameFromFile: false,
    },
  },
  {
    id: "link",
    label: "Links",
    one: "link",
    addLabel: "Add a link",
    placeholder: "What the link is (the live site, the design, the repository)",
    doneLabel: "done",
    empty: "No links on this project yet. Add the first one above.",
    isPublic: true,
    shape: { text: NOTE, url: true, talk: false, files: "none", tick: false, numbered: false, nameFromFile: false },
  },
  {
    id: "document",
    label: "Documents",
    one: "document",
    addLabel: "Add a document",
    placeholder: "What the document is (left empty, the file's own name is used)",
    doneLabel: "done",
    empty: "No documents on this project yet. Add the first one above.",
    isPublic: true,
    shape: { text: NOTE, url: false, talk: false, files: "required", tick: false, numbered: false, nameFromFile: true },
  },
  {
    // A file kept with the day it was taken and its number, so a backup is never lost among the rest
    id: "backup",
    label: "Backups",
    one: "backup",
    addLabel: "Add a backup",
    placeholder: "What this backup is (left empty, the file's own name is used)",
    doneLabel: "done",
    empty: "No backups kept on this project yet. Upload the first one above.",
    isPublic: false,
    shape: { text: NOTE, url: false, talk: false, files: "required", tick: false, numbered: true, nameFromFile: true },
  },
] as const

export type ProjectItemKind = (typeof PROJECT_ITEM_KINDS)[number]["id"]
export const PROJECT_ITEM_KIND_IDS = PROJECT_ITEM_KINDS.map((kind) => kind.id) as [ProjectItemKind, ...ProjectItemKind[]]
export const DEFAULT_PROJECT_ITEM_KIND: ProjectItemKind = PROJECT_ITEM_KINDS[0].id

/** One kind by its id, falling back to the default so an unknown value never leaves a page blank. */
export const projectItemKind = (id: string | null | undefined) =>
  PROJECT_ITEM_KINDS.find((kind) => kind.id === id) ?? PROJECT_ITEM_KINDS[0]

/** What an item of that kind carries, which is what both surfaces render it from. */
export const projectItemShape = (id: string | null | undefined): ProjectItemShape => projectItemKind(id).shape

/**
 * The tabs a shared link may show, and the only kinds it may read or write: Credentials and Backups
 * are not among them. A page lists these, `readPublicProject` reads these, and every public write
 * is held to these, so leaving one out of any single place could not open it on its own.
 */
export const PUBLIC_ITEM_KINDS = PROJECT_ITEM_KINDS.filter((kind) => kind.isPublic)
export const PUBLIC_ITEM_KIND_IDS = PUBLIC_ITEM_KINDS.map((kind) => kind.id) as [ProjectItemKind, ...ProjectItemKind[]]
export const DEFAULT_PUBLIC_ITEM_KIND: ProjectItemKind = PUBLIC_ITEM_KINDS[0].id
/** Whether a shared link may ever show an item of that kind. An unknown kind reads as a change. */
export const isPublicItemKind = (id: string | null | undefined): boolean => projectItemKind(id).isPublic

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
// A link item's own web address. Long enough for any signed or tracked address anyone would paste
export const PROJECT_URL_MAX_LENGTH = 2_000
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
  badKind: "Choose which tab it belongs on.",
  // The link, the document and the backup tabs each need one thing of their own
  missingUrl: "Give the web address, starting with http:// or https://.",
  badUrl: "That web address doesn't look right. It must start with http:// or https://.",
  missingText: (label: string) => `Write the ${label.toLowerCase()} under the name.`,
  missingFile: "Attach the file first.",
  // What a shared link may never carry, said where the link is made
  privateTabs: "Credentials and backups are never shared: they stay on your side of this project.",
  saveFailed: "Couldn't save it. Please try again.",
  deleteFailed: "Couldn't remove it. Please try again.",
  created: "Added.",
  saved: "Saved.",
  deleted: "Removed.",
  deleteExplains: "It goes with its images, its files and its voice note. This can't be undone.",
  noProjects: "No client projects yet. Add a project to a client in Clients Management, and it shows here.",
  noResults: "No project matches the search or the filters.",
  // The list is every project at a glance; one project's own page is where the work on it is done
  manage: "Manage",
  manageOne: (name: string) => `Open ${name}`,
  backToProjects: "All projects",
  nothingOnIt: "Nothing on it yet",
  shared: "Shared",
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
    "Anyone with this link can read this project and add, change and remove its changes, ideas, discussion, links and documents, with images and voice notes, without signing in. Send it to the client; turn it off to stop it.",
  linkReplaced: "New link made. The old one stopped working.",
  linkOff: "Link turned off.",
  linkCopied: "Link copied.",
} as const

/**
 * What the file viewer says. It is its own set because both surfaces show it and because what a
 * browser can and cannot show is a thing to explain plainly rather than to leave as a blank frame.
 */
export const PROJECT_FILE_MESSAGES = {
  preview: "Preview",
  download: "Download",
  openInTab: "Open in a new tab",
  // A type no browser renders: a Word document, or one the app no longer places
  noPreview: "This kind of file can't be shown in a browser. Download it and your computer will open it.",
  // A type the app takes that this browser can't decode (a TIFF image, a .mov or .mkv video)
  cannotShow: "This browser can't show this file. Download it and open it on your computer.",
} as const

/**
 * Folders, on the tabs whose items are kept rather than discussed: **Documents and Links**. They
 * are the app's only nested folders (`models/ClientProjectFolder.ts`), because a document is filed
 * the way a file is, inside another folder when that is what it belongs in.
 *
 * The other tabs are a conversation about the work (changes, ideas, discussion) or are already
 * ordered by their own rule (backups are numbered, credentials are a short list), so they stay flat.
 */
export const FOLDERED_ITEM_KINDS = ["document", "link"] as const
export type FolderedItemKind = (typeof FOLDERED_ITEM_KINDS)[number]
export const hasFolders = (kind: string): kind is FolderedItemKind =>
  (FOLDERED_ITEM_KINDS as readonly string[]).includes(kind)

// How deep the tree goes: a folder, and four more inside it. Deeper is a filing system nobody reads
export const PROJECT_FOLDER_MAX_DEPTH = 5
// Per project and tab; a longer list is a sign of tags, not folders
export const MAX_PROJECT_FOLDERS = 200
// A folder's name is a label, like every other folder name in the app
export const PROJECT_FOLDER_NAME_MAX_LENGTH = 60
// What the top of the tree is called, where an item sits in no folder at all
export const PROJECT_ROOT_FOLDER_LABEL = "All documents"

/**
 * Writing a document in the app instead of uploading one: a name and the text, kept as a .txt file
 * on the item, so a note that belongs with the project's files is filed with them rather than
 * living somewhere else.
 */
export const PROJECT_DOCUMENT_TEXT_MAX_LENGTH = TEXT_BOX_MAX_LENGTH
export const PROJECT_DOCUMENT_NAME_MAX_LENGTH = 120

export const PROJECT_FOLDER_MESSAGES = {
  root: PROJECT_ROOT_FOLDER_LABEL,
  newFolder: "New folder",
  newSubfolder: "New folder inside this one",
  rename: "Rename",
  move: "Move",
  moveHere: "Move here",
  missingName: "Name the folder.",
  nameTooLong: `Keep the folder name under ${PROJECT_FOLDER_NAME_MAX_LENGTH} characters.`,
  duplicate: "A folder with that name is already here.",
  tooDeep: `Folders go ${PROJECT_FOLDER_MAX_DEPTH} levels deep at most.`,
  tooMany: `You can keep up to ${MAX_PROJECT_FOLDERS} folders on one tab.`,
  notFound: "That folder no longer exists.",
  // Moving a folder into itself, or into one of its own folders, would cut it off the tree
  intoItself: "A folder can't be moved inside itself.",
  createFailed: "Couldn't make the folder. Please try again.",
  renameFailed: "Couldn't rename the folder. Please try again.",
  moveFailed: "Couldn't move it. Please try again.",
  deleteFailed: "Couldn't delete the folder. Please try again.",
  // Nothing is lost with a folder: what was in it comes up one level
  deleteExplains: "What is inside comes up one level: the folders and the items are kept.",
  deleted: "Folder deleted. What was inside came up one level.",
  empty: "This folder is empty.",
  noMatch: "Nothing in this folder matches that search.",
  searchHere: "Search in this folder",
  // Said under the search box, so it is clear what is being searched
  searchScope: "Searching this folder and the folders inside it.",
  // Writing a document in the app
  write: "Create document",
  writeHint: "Write a .txt file and keep it with this project.",
  writeName: "File name",
  writeText: "What the document says",
  writeMissingName: "Give the document a name.",
  writeMissingText: "Write something in the document.",
  writeFailed: "Couldn't create the document. Please try again.",
  written: "Document created.",
} as const

export const PUBLIC_PROJECT_MESSAGES = {
  // Every refusal about the link reads the same, so a guessed token learns nothing
  invalid: "That link doesn't open anything.",
  // On the shared page, so whoever opens it knows they may write rather than guessing
  canWrite: "You can add and change items here",
  intro: "Add what you need under any of the tabs. Everything you add shows up for the project owner straight away.",
} as const
