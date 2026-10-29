import type {
  EstimateUnit,
  ProjectFileCategory,
  ProjectItemKind,
  ProjectPriority,
  ProjectTaskStatus,
  RoadmapStage,
} from "@/constants/clientProjectTasks"
import type { TaskImage, TaskImageView } from "./taskAttachment"
import type { ClientKind, ClientProjectStatus } from "@/constants/clients"

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

/**
 * The same file as a page receives it, with short-lived links.
 *
 * There are two, because they are signed for two different things: `url` is the **download**, which
 * carries the file's own name and is always an attachment, and `previewUrl` is the file **shown
 * where it is** (an image, a PDF, a video, a sound, a text file), which is null for a kind no
 * browser can show, such as a Word document.
 */
export interface ProjectFileView extends ProjectFile {
  url: string
  previewUrl: string | null
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

/**
 * How long a backlog item is expected to take: a number and the unit it is counted in. Null on an
 * item nobody has estimated, and on every tab but the backlog.
 */
export interface ProjectEstimate {
  value: number
  unit: EstimateUnit
}

/** One item on a client project, as it is stored. */
export interface ProjectTaskRecord {
  content: string
  folderId?: string | null
  description: string
  // A link item's web address; "" on every other kind
  url: string
  images: TaskImage[]
  files: ProjectFile[]
  voiceNote: VoiceNote | null
  status: ProjectTaskStatus
  kind: ProjectItemKind
  role: string
  assigneeId: string | null
  priority: ProjectPriority
  estimate: ProjectEstimate | null
  stage: RoadmapStage | null
  isClientVisible: boolean
}

/** One item as a page receives it: its links are signed and short-lived. */
export interface ProjectTask {
  id: string
  projectId: string
  content: string
  description: string
  // Where a link item points, as it is stored (with https:// in front when none was typed)
  url: string
  images: TaskImageView[]
  files: ProjectFileView[]
  voiceNote: VoiceNoteView | null
  status: ProjectTaskStatus
  // Which tab it sits under; an item saved before the tabs existed reads as a change
  kind: ProjectItemKind
  // A team member's role on the project, shown beside their name; "" on every other tab
  role: string
  /**
   * The team member the work is assigned to (the id of an item on the Team Members tab), on the
   * tabs that can be signed off. Null when nobody is, and always null on a shared link, which never
   * carries the team.
   */
  assigneeId: string | null
  // The folder it is filed in, on the tabs that have folders; null at the top of the tree
  folderId: string | null
  position: number
  // How urgent it is, on every tab. An item saved before priorities reads as Medium
  priority: ProjectPriority
  // How long it is expected to take, on the backlog; null everywhere else and when nobody has said
  estimate: ProjectEstimate | null
  /**
   * Its number **on its own tab**, given when it was added and kept for good: AA Change 12 stays
   * AA Change 12 however the list is ordered and whatever is deleted around it. An item saved
   * before numbering has 0, which reads as no number rather than as the first one.
   */
  number: number
  /**
   * When the work was signed off as agreed, on the tabs that can be. **Who signed is not stored**,
   * at the owner's request, so an item reads as signed or not signed and nothing more. Null on
   * everything nobody has signed, which is how every item saved before sign-off reads.
   */
  signedAt: string | null
  // Where a roadmap item has got to; null on every other tab, which reads as Planned
  stage: RoadmapStage | null
  // Whether the client may read this note. False everywhere else, so nothing is shared by accident
  isClientVisible: boolean
  // An overview voice written out in clear English; null until it is, and again once it is recorded anew
  voiceText: ProjectVoiceText | null
  createdAt: string
  updatedAt: string
}

/** One person on the project's team, as an assignment picker offers them: who, and what they do. */
export interface ProjectTeamMember {
  id: string
  name: string
  role: string
}

/** An overview voice, written out word for word and read back in clear English. */
export interface ProjectVoiceText {
  english: string
  transcript: string
  // The language it was spoken in, named in English ("Roman Urdu")
  language: string
  // Who wrote the English, so the page can say so; null on one written before it was kept
  provider: string | null
}

/**
 * What an item is saved with. Everything but the line is optional, so a one-line item costs
 * nothing, and the kind left out means a change (the first tab).
 */
/**
 * A folder the documents or links of one project are filed in. The tree is nested, so a folder
 * names the one it sits in (`parentId`, null at the top), and `depth` is how far down it is, worked
 * out on the server so a page never has to walk the list to draw the tree.
 */
export interface ProjectFolder {
  id: string
  projectId: string
  kind: ProjectItemKind
  name: string
  parentId: string | null
  depth: number
  // How many items of that tab are filed directly in it, and in it and everything inside it
  itemCount: number
  totalItemCount: number
}

export interface ProjectFolderInput {
  kind: ProjectItemKind
  name: string
  parentId?: string | null
}

/** What writing a document in the app takes: its name and what it says. */
export interface ProjectDocumentInput {
  name: string
  text: string
  folderId?: string | null
}

export interface ProjectTaskInput {
  content: string
  description?: string
  url?: string
  images?: TaskImage[]
  files?: ProjectFile[]
  voiceNote?: VoiceNote | null
  status?: ProjectTaskStatus
  // Which tab it is on. On a change it **moves the item to that tab**, which only the tabs people
  // write on allow; left out, the item stays where it is
  kind?: ProjectItemKind
  // Where to file it, or null for the top. Left out, an item is not moved
  folderId?: string | null
  priority?: ProjectPriority
  // A team member's role. Left out, it is not touched
  role?: string
  // Who the work is assigned to, a team member's id, or null for nobody. Left out, it is not touched
  assigneeId?: string | null
  // The estimate, on the backlog. Null clears it; left out, it is not touched
  estimate?: ProjectEstimate | null
  // Where a roadmap item has got to. Left out, it is not touched
  stage?: RoadmapStage
  // Whether the client may read this note. Left out, it is not touched
  isClientVisible?: boolean
  /**
   * Signing the work off, or taking the mark off again: true records the day, false clears it.
   * It is its own small write, like ticking an item, so it never carries the item's words back.
   */
  signed?: boolean
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
  // Whether the client is one person or a business; Projects Management shows it beside the name
  clientKind?: ClientKind
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
  clients: { id: string; name: string; kind: ClientKind }[]
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
