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
  createdAt: string
  updatedAt: string
}

export interface ClientProjectInput {
  name: string
  description: string
  status: ClientProjectStatus
}

/** A client's projects with the counts the panel shows above them. */
export interface ClientProjectsPage {
  projects: ClientProject[]
  counts: { active: number; completed: number }
}
