import { Building2, type LucideIcon } from "lucide-react"
import { TEXT_BOX_MAX_LENGTH } from "./textLimits"

/**
 * Clients Management: the clients themselves, kept in one place instead of inside the Client Tasks
 * Messaging popup they used to live in. A client is the same record that module has always written
 * to (the `clients` collection, `constants/clientMessaging.ts` holds its field limits and the
 * messages its validation uses), so nothing already saved changes shape.
 *
 * Under each client are its projects: the pieces of work being done for them. **A client's project
 * is also what a Prompt Creator prompt is written for**, at the owner's request: there used to be a
 * second list of projects of its own (`/projects`, the `prompt_projects` collection), which is gone.
 * A project carries the standing instructions every prompt written in it ends with
 * (`promptInstructions`) and the Prompt Creator folder those prompts are filed in (`folderId`), and
 * Prompt Creator only picks from this list, so there is one place a project is made and named.
 */

export const CLIENTS_ENDPOINT = "/api/clients"

// A project's name is a label, not a sentence, like a client's own name
export const CLIENT_PROJECT_NAME_MAX_LENGTH = 80
// What the project is, in the user's own words. No model reads it (a client's message format and
// samples are what Client Messaging sends), so it takes the shared text box ceiling
export const CLIENT_PROJECT_DESCRIPTION_MAX_LENGTH = TEXT_BOX_MAX_LENGTH
// Enough for the work one client has on; a longer list is a sign of tasks, not projects
export const MAX_CLIENT_PROJECTS = 200

/**
 * The standing instructions added to the end of every Prompt Creator prompt written in this project
 * (`appendInstructions`), so a rule that holds for all of a project's work ("we use Next.js 16",
 * "answer in British English") is written once instead of every time. Optional: a project without
 * them leaves every prompt exactly as it was written.
 *
 * A model reads them as part of the prompt, so this is **not** one of the plain text boxes: it keeps
 * the same 4,000 the deleted Projects module used.
 */
export const CLIENT_PROJECT_INSTRUCTIONS_MAX_LENGTH = 4000

/**
 * Where a project stands, in the order the dropdown offers them (at the owner's request: Active and
 * Completed were not enough to say what a project really is). `isOpen` is whether it is still work
 * in hand: open projects come first wherever projects are offered (Prompt Creator's picker), and
 * a closed one is marked. A project saved before these existed is one of the first two and reads
 * exactly as it did.
 */
export const CLIENT_PROJECT_STATUSES = [
  { id: "discovery", label: "Discovery", description: "Talking it through and finding out what they need", isOpen: true },
  { id: "planning", label: "Planning", description: "Agreed and being scoped, work not started yet", isOpen: true },
  { id: "active", label: "Active", description: "Being worked on now", isOpen: true },
  { id: "on-hold", label: "On hold", description: "Paused, waiting on the client or something else", isOpen: true },
  { id: "maintenance", label: "Maintenance", description: "Delivered, with ongoing support and small fixes", isOpen: true },
  { id: "completed", label: "Completed", description: "Delivered and closed", isOpen: false },
  { id: "cancelled", label: "Cancelled", description: "Stopped before it was finished", isOpen: false },
] as const

export type ClientProjectStatus = (typeof CLIENT_PROJECT_STATUSES)[number]["id"]

export const CLIENT_PROJECT_STATUS_IDS = CLIENT_PROJECT_STATUSES.map((status) => status.id) as [
  ClientProjectStatus,
  ...ClientProjectStatus[],
]

export const DEFAULT_CLIENT_PROJECT_STATUS: ClientProjectStatus = "active"

/** One status by its id; anything the app no longer knows reads as the default rather than as nothing. */
export const clientProjectStatus = (id: string) =>
  CLIENT_PROJECT_STATUSES.find((status) => status.id === id) ?? CLIENT_PROJECT_STATUSES.find((status) => status.id === DEFAULT_CLIENT_PROJECT_STATUS)!

// Whether a project is still work in hand (every status but Completed and Cancelled)
export const isOpenProjectStatus = (id: string) => clientProjectStatus(id).isOpen

/** How many projects stand at each status, every status present (0 when none). */
export const countByStatus = (statuses: readonly string[]): Record<ClientProjectStatus, number> =>
  Object.fromEntries(
    CLIENT_PROJECT_STATUSES.map((status) => [status.id, statuses.filter((id) => clientProjectStatus(id).id === status.id).length])
  ) as Record<ClientProjectStatus, number>

/** The counts as one short line, only the statuses that have any: "4 active · 1 maintenance". */
export const describeStatusCounts = (counts: Record<ClientProjectStatus, number>) =>
  CLIENT_PROJECT_STATUSES.filter((status) => counts[status.id] > 0)
    .map((status) => `${counts[status.id]} ${status.label.toLowerCase()}`)
    .join(" · ") || "No projects yet"

/**
 * Whether a client is one person or a company, chosen on the client's form (at the owner's request).
 * Individual is the default and what every client saved before reads as.
 */
// The most clients one dragged order may name; far past any real list, so it only stops a runaway body
export const MAX_CLIENTS = 1000

export const CLIENT_KINDS = [
  { id: "individual", label: "Individual", description: "One person you work with directly" },
  { id: "company", label: "Company", description: "A business, agency or team" },
] as const

export type ClientKind = (typeof CLIENT_KINDS)[number]["id"]

export const CLIENT_KIND_IDS = CLIENT_KINDS.map((kind) => kind.id) as [ClientKind, ...ClientKind[]]

export const DEFAULT_CLIENT_KIND: ClientKind = "individual"

// A stored value the app no longer knows reads as the default, so every client always has a kind
export const clientKindOf = (id: unknown): ClientKind => (CLIENT_KIND_IDS as readonly unknown[]).includes(id) ? (id as ClientKind) : DEFAULT_CLIENT_KIND

export const CLIENTS_MESSAGES = {
  loadFailed: "Couldn't load your clients. Please try again.",
  notFound: "That client no longer exists.",
  saveFailed: "Couldn't save the client. Please try again.",
  deleteFailed: "Couldn't remove the client. Please try again.",
  created: "Client added.",
  saved: "Client saved.",
  deleted: "Client removed.",
  // What deleting a client takes with it, so the confirmation can say so
  deleteExplains: "Its projects go with it. Messages already written for this client stay in the history.",
  empty: "No clients yet. Add the first one, with their message format and two sample messages.",
  noMatch: "No clients match these filters.",
  kindLabel: "Individual or company",
  // The two filters beside the search
  kindFilter: "Type",
  anyKind: "Any type",
  projectStatusFilter: "Has a project that is",
  anyProjectStatus: "Any project",
  // Dragging the clients into the order they are worked with
  dragHint: "Drag a client by its handle to put it where you want it in the list.",
  dragOffWhileFiltered: "Clear the filters to drag the clients into order.",
  orderFailed: "Couldn't save the new order. Please try again.",
  orderChanged: "Your clients changed in another tab, so the list was read again.",
  choose: "Choose a client",
  chooseHint: "Their details and the projects you are doing for them open here.",
  // The message format and the sample messages are long, and reading them is not what this page is
  // for, so the card keeps the client themselves and these open in a popup
  details: "Details",
  detailsOf: (name: string) => `${name}: message details`,
  detailsExplains: "The format every message for this client follows, and the sample messages it is written from.",
} as const

export const CLIENT_PROJECT_MESSAGES = {
  loadFailed: "Couldn't load this client's projects. Please try again.",
  notFound: "That project no longer exists.",
  saveFailed: "Couldn't save the project. Please try again.",
  deleteFailed: "Couldn't remove the project. Please try again.",
  created: "Project added.",
  saved: "Project saved.",
  deleted: "Project removed.",
  missingName: "Give the project a name.",
  nameTooLong: `The project name must be under ${CLIENT_PROJECT_NAME_MAX_LENGTH} characters.`,
  descriptionTooLong: `The description must be under ${CLIENT_PROJECT_DESCRIPTION_MAX_LENGTH.toLocaleString()} characters.`,
  missingStatus: "Choose where the project stands.",
  statusLabel: "Status",
  // Dragging the projects of one client into the order they are worked in
  dragHint: "Drag a project by its handle to put it where you want it in the list.",
  orderFailed: "Couldn't save the new order. Please try again.",
  orderChanged: "This client's projects changed in another tab, so the list was read again.",
  tooMany: `You can keep up to ${MAX_CLIENT_PROJECTS} projects for one client.`,
  empty: "No projects for this client yet.",
  deleteExplains:
    "This can't be undone. The client and their messages stay as they are, and so do any prompts written for this project and the folder they are filed in.",
  // The prompt instructions, which live on the project and are used by Prompt Creator
  instructionsLabel: "Instructions for every prompt in it (optional)",
  instructionsHint: "Added to the end of every Prompt Creator prompt written for this project.",
  instructionsTooLong: `Keep the instructions under ${CLIENT_PROJECT_INSTRUCTIONS_MAX_LENGTH.toLocaleString()} characters.`,
  instructionsPlaceholder: "e.g. We use Next.js 16 and Tailwind. Answer in British English. Never change the database schema.",
  // On a project that has them, so the list says which projects carry instructions
  hasInstructions: "Prompt instructions",
} as const

// The module's sidebar entry, listed first under Client Work: the people the work is for
export const CLIENTS_TOOL: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: "clients"
} = {
  id: "clients",
  title: "Clients Management",
  description: "Clients and their projects",
  icon: Building2,
  href: "/clients",
  group: "clients",
}
