import type { ProjectFileCategory, ProjectItemAuthor, ProjectItemKind, ProjectTaskStatus } from "@/constants/clientProjectTasks"
import type { TaskImage, TaskImageView } from "./taskAttachment"
import type { ClientProjectStatus } from "@/constants/clients"

/** One voice note, as it is stored on an item: what it is and where its object lives. */
export interface VoiceNote {
  // The id the server made for it; the object's key is built from this, never from the browser
  assetId: string
  contentType: string
  // How long it runs, as the browser timed it, for the player to show before it loads
  seconds: number
}

/** The same voice note as a page receives it, with a short-lived link to play it from. */
export interface VoiceNoteView extends VoiceNote {
  url: string
}

/**
 * One file on an item, as it is stored: what it is, what to call it and where its object lives.
 * The name is the one the person picked it with, shown on the item and used as the download's file
 * name; the key is built on the server from `assetId`, never from the name.
 */
export interface ProjectFile {
  assetId: string
  name: string
  contentType: string
  // What the app places it as (image, pdf, word, text, video, audio), for the icon and the player
  category: ProjectFileCategory
  size: number
}

/** The same file as a page receives it, with a short-lived link to open or play it from. */
export interface ProjectFileView extends ProjectFile {
  url: string
}

/**
 * What the browser is told to do with a file it is sending: the id the chunks go under, how big a
 * chunk may be and how many there are. A file small enough for one chunk still goes this way, so
 * the page has one path rather than two.
 */
export interface ProjectFileUploadPlan {
  assetId: string
  chunkBytes: number
  chunks: number
}

/** Where a file has got to while the server joins its chunks, so a page can show progress. */
export interface ProjectFileProgress {
  done: boolean
  // The finished file, once it is joined and ready to be saved on an item
  file: ProjectFileView | null
  joinedBytes: number
  totalBytes: number
}

/** One item on a client project, as it is stored. */
export interface ProjectTaskRecord {
  content: string
  description: string
  images: TaskImage[]
  files: ProjectFile[]
  voiceNote: VoiceNote | null
  status: ProjectTaskStatus
  kind: ProjectItemKind
  addedBy: ProjectItemAuthor
}

/** One item as a page receives it: its links are signed and short-lived. */
export interface ProjectTask {
  id: string
  projectId: string
  content: string
  description: string
  images: TaskImageView[]
  files: ProjectFileView[]
  voiceNote: VoiceNoteView | null
  status: ProjectTaskStatus
  // Which tab it sits under; an item saved before the tabs existed reads as a change
  kind: ProjectItemKind
  // Whether the project's owner added it or someone writing from the shared link did
  addedBy: ProjectItemAuthor
  position: number
  createdAt: string
  updatedAt: string
}

/**
 * What an item is saved with. Everything but the line is optional, so a one-line item costs
 * nothing, and the kind left out means a change (the first tab).
 */
export interface ProjectTaskInput {
  content: string
  description?: string
  images?: TaskImage[]
  files?: ProjectFile[]
  voiceNote?: VoiceNote | null
  status?: ProjectTaskStatus
  kind?: ProjectItemKind
}

/** How one tab of a project stands: how many items it holds and how many are ticked off. */
export interface ProjectItemCount {
  total: number
  done: number
}

/** One client project in the list, with the client it is for and how each of its tabs stands. */
export interface ProjectWithTasks {
  id: string
  clientId: string
  clientName: string
  name: string
  description: string
  status: ClientProjectStatus
  // Every item of the project, whichever tab it is on, so the row reads at a glance
  taskCount: number
  doneCount: number
  // One entry per tab, so each tab can carry its own count without reading the items
  counts: Record<ProjectItemKind, ProjectItemCount>
  // The token of the link that shares it, when one has been made and is still on; the page puts it
  // after its own origin
  publicToken: string | null
  createdAt: string
  updatedAt: string
}

/** The projects page: every project the viewer may see, with the clients to filter by. */
export interface ClientProjectsPage {
  projects: ProjectWithTasks[]
  clients: { id: string; name: string }[]
}

/**
 * What a shared link shows: the project, its client and every item under it, and nothing else. It
 * never carries whose account the project is, what else that client has, or any id but each item's
 * own, because whoever holds the link is not signed in to anything.
 */
export interface PublicProject {
  name: string
  description: string
  status: ClientProjectStatus
  clientName: string
  tasks: ProjectTask[]
  // When the project itself last changed, so a reader can tell how fresh this is
  updatedAt: string
}
