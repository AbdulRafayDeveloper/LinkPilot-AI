import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { ClientProjectModel, type IClientProject } from "@/models/ClientProject"
import { CLIENT_PROJECT_MESSAGES, MAX_CLIENT_PROJECTS } from "@/constants/clients"
import { visibleById, visibleTo } from "@/services/auth/viewer"
import { getClient } from "@/services/clientMessaging/clients"
import type { ClientProject, ClientProjectInput, ClientProjectsPage } from "@/types/clients"
import type { Viewer } from "@/types/auth"

/**
 * The projects being done for a client, kept in the client_projects collection. A project belongs to
 * the account that added it, exactly like the client does: a user sees their own, an admin sees them
 * all. Every call names the client first, and a client the viewer may not see answers as no client at
 * all, so a project can never be read or written through someone else's client.
 */

type StoredProject = IClientProject & { _id: { toString: () => string } }

const toProject = (record: StoredProject): ClientProject => ({
  id: record._id.toString(),
  clientId: record.clientId,
  name: record.name,
  description: record.description ?? "",
  status: record.status,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
})

// Only the fields the project owns, each trimmed
const cleanInput = ({ name, description, status }: ClientProjectInput) => ({
  name: name.replace(/\s+/g, " ").trim(),
  description: description.trim(),
  status,
})

/**
 * The client a project belongs to, or null when the viewer may not see it. Every project call goes
 * through this first, so the client's own ownership rules decide who reaches its projects.
 */
async function clientOrNull(viewer: Viewer, clientId: string) {
  return getClient(viewer, clientId)
}

/** A client's projects, newest first, with the active and completed counts. Null when the client is gone. */
export async function listClientProjects(viewer: Viewer, clientId: string): Promise<ClientProjectsPage | null> {
  if (!(await clientOrNull(viewer, clientId))) return null
  await connectDatabase()
  const records = (await ClientProjectModel.find({ ...visibleTo(viewer), clientId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(MAX_CLIENT_PROJECTS)
    .lean()) as unknown as StoredProject[]
  const projects = records.map(toProject)
  return {
    projects,
    counts: {
      active: projects.filter((project) => project.status === "active").length,
      completed: projects.filter((project) => project.status === "completed").length,
    },
  }
}

/** Adds a project to a client. Null when the client is gone; throws when the client is already full. */
export async function createClientProject(viewer: Viewer, clientId: string, input: ClientProjectInput): Promise<ClientProject | null> {
  if (!(await clientOrNull(viewer, clientId))) return null
  await connectDatabase()
  const held = await ClientProjectModel.countDocuments({ ...visibleTo(viewer), clientId })
  if (held >= MAX_CLIENT_PROJECTS) throw new UserFacingError(CLIENT_PROJECT_MESSAGES.tooMany)
  const record = await ClientProjectModel.create({ ownerId: viewer.id, clientId, ...cleanInput(input) })
  return toProject(record as unknown as StoredProject)
}

/** Replaces a project's name, description and status. Null when the client or the project is gone. */
export async function updateClientProject(
  viewer: Viewer,
  clientId: string,
  projectId: string,
  input: ClientProjectInput
): Promise<ClientProject | null> {
  const filter = visibleById(viewer, projectId)
  if (!filter || !(await clientOrNull(viewer, clientId))) return null
  await connectDatabase()
  const record = await ClientProjectModel.findOneAndUpdate({ ...filter, clientId }, cleanInput(input), {
    returnDocument: "after",
    runValidators: true,
  }).lean()
  return record ? toProject(record as unknown as StoredProject) : null
}

/** Removes one project. False when the client or the project is gone. */
export async function deleteClientProject(viewer: Viewer, clientId: string, projectId: string): Promise<boolean> {
  const filter = visibleById(viewer, projectId)
  if (!filter || !(await clientOrNull(viewer, clientId))) return false
  await connectDatabase()
  const { deletedCount } = await ClientProjectModel.deleteOne({ ...filter, clientId })
  return deletedCount > 0
}
