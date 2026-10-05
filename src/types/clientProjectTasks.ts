import type { ProjectTaskStatus } from "@/constants/clientProjectTasks"
import type { TaskImage, TaskImageView } from "./taskAttachment"
import type { ClientProjectStatus } from "@/constants/clients"

/** One voice note, as it is stored on a task: what it is and where its object lives. */
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

/** One task on a client project, as it is stored. */
export interface ProjectTaskRecord {
  content: string
  description: string
  images: TaskImage[]
  voiceNote: VoiceNote | null
  status: ProjectTaskStatus
}

/** One task as a page receives it: its links are signed and short-lived. */
export interface ProjectTask {
  id: string
  projectId: string
  content: string
  description: string
  images: TaskImageView[]
  voiceNote: VoiceNoteView | null
  status: ProjectTaskStatus
  position: number
  createdAt: string
  updatedAt: string
}

/** What a task is saved with. Everything but the line is optional, so a one-line task costs nothing. */
export interface ProjectTaskInput {
  content: string
  description?: string
  images?: TaskImage[]
  voiceNote?: VoiceNote | null
  status?: ProjectTaskStatus
}

/** One client project in the list, with the client it is for and how its tasks stand. */
export interface ProjectWithTasks {
  id: string
  clientId: string
  clientName: string
  name: string
  description: string
  status: ClientProjectStatus
  taskCount: number
  doneCount: number
  // The token of the link that shows it read only, when one has been made and is still on; the
  // page puts it after its own origin
  publicToken: string | null
  createdAt: string
  updatedAt: string
}

/** The projects page: every project the viewer may see, with the clients to filter by. */
export interface ClientProjectsPage {
  projects: ProjectWithTasks[]
  clients: { id: string; name: string }[]
}

/** What the public link shows: the project, its client and its tasks, and nothing else. */
export interface PublicProject {
  name: string
  description: string
  status: ClientProjectStatus
  clientName: string
  tasks: ProjectTask[]
  // When the project itself last changed, so a reader can tell how fresh this is
  updatedAt: string
}
