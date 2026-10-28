import type { ClientProjectStatus } from "@/constants/clients"

/**
 * One project being done for a client, as the API serves it. It mirrors the shape of the client
 * itself (a short name and one block of text in the user's own words) without carrying the fields
 * that only make sense for the person: their country and their message samples.
 */
export interface ClientProject {
  id: string
  // The client it belongs to; a project never exists on its own
  clientId: string
  name: string
  // What the work is, in the user's own words. Optional, so a project can be added by name alone
  description: string
  status: ClientProjectStatus
  /**
   * The standing instructions every Prompt Creator prompt written for this project ends with, and
   * the folder those prompts are filed in. Empty and null on a project that has neither.
   */
  promptInstructions: string
  folderId: string | null
  createdAt: string
  updatedAt: string
}

export interface ClientProjectInput {
  name: string
  description: string
  status: ClientProjectStatus
  // Optional in the API; a request that leaves it out keeps whatever the project has
  promptInstructions?: string
}

/**
 * One project as Prompt Creator's picker needs it: the project, whose client it is for, the
 * instructions a prompt written for it ends with, and how many prompts there already are.
 */
export interface PromptProject {
  id: string
  name: string
  clientId: string
  clientName: string
  status: ClientProjectStatus
  instructions: string
  promptCount: number
  folderId: string | null
}

/** A client's projects, in their dragged order, with how many stand at each status. */
export interface ClientProjectsPage {
  projects: ClientProject[]
  counts: Record<ClientProjectStatus, number>
}
