import { Building2, type LucideIcon } from "lucide-react"

/**
 * Clients Management: the clients themselves, kept in one place instead of inside the Client Tasks
 * Messaging popup they used to live in. A client is the same record that module has always written
 * to (the `clients` collection, `constants/clientMessaging.ts` holds its field limits and the
 * messages its validation uses), so nothing already saved changes shape.
 *
 * Under each client are its projects: the pieces of work being done for them. A project is not a
 * Prompt Creator project (`constants/promptProjects.ts`), which is what a prompt was written for;
 * these two never share a record, a route or a collection.
 */

export const CLIENTS_ENDPOINT = "/api/clients"

// A project's name is a label, not a sentence, like a client's own name
export const CLIENT_PROJECT_NAME_MAX_LENGTH = 80
// What the project is, in the user's own words; the same room a client's message format gets
export const CLIENT_PROJECT_DESCRIPTION_MAX_LENGTH = 2000
// Enough for the work one client has on; a longer list is a sign of tasks, not projects
export const MAX_CLIENT_PROJECTS = 200

export const CLIENT_PROJECT_STATUSES = [
  { id: "active", label: "Active", description: "Still being worked on" },
  { id: "completed", label: "Completed", description: "Delivered and closed" },
] as const

export type ClientProjectStatus = (typeof CLIENT_PROJECT_STATUSES)[number]["id"]

export const CLIENT_PROJECT_STATUS_IDS = CLIENT_PROJECT_STATUSES.map((status) => status.id) as [
  ClientProjectStatus,
  ...ClientProjectStatus[],
]

export const DEFAULT_CLIENT_PROJECT_STATUS: ClientProjectStatus = "active"

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
  choose: "Choose a client",
  chooseHint: "Their details and the projects you are doing for them open here.",
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
  missingStatus: "Choose whether the project is active or completed.",
  tooMany: `You can keep up to ${MAX_CLIENT_PROJECTS} projects for one client.`,
  empty: "No projects for this client yet.",
  deleteExplains: "This can't be undone. The client and their messages stay as they are.",
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
