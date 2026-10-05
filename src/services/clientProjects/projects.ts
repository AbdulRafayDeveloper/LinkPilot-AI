import { connectDatabase } from "@/lib/db"
import { ClientProjectModel, type IClientProject } from "@/models/ClientProject"
import { ClientProjectTaskModel } from "@/models/ClientProjectTask"
import { Client } from "@/models/Client"
import { MAX_CLIENT_PROJECTS } from "@/constants/clients"
import { projectLinkToken, projectLinkMatches, readProjectLinkToken } from "@/lib/projectLink"
import { visibleById, visibleTo } from "@/services/auth/viewer"
import { listProjectTasks } from "./tasks"
import type { ClientProjectsPage, ProjectWithTasks, PublicProject } from "@/types/clientProjectTasks"
import type { ClientProjectStatus } from "@/constants/clients"
import type { Viewer } from "@/types/auth"

/**
 * Every client's projects in one list, with the tasks under each counted, and the read-only link a
 * project can be shared by.
 *
 * The projects themselves belong to Clients Management (`services/clients/projects.ts`), which is
 * still the only place they are added, renamed or removed; this reads them across every client and
 * owns only what this module adds: the tasks and the link.
 */

type StoredProject = IClientProject & { _id: { toString: () => string } }

/**
 * The token of a project's read-only link, or null when it has none on. The page puts it after its
 * own origin, the way an employee's plan link is built, so nothing here has to know the address the
 * app is being read at.
 */
export const publicProjectToken = (project: Pick<IClientProject, "publicLinkActive" | "publicLinkVersion">, id: string): string | null =>
  project.publicLinkActive ? projectLinkToken(id, project.publicLinkVersion ?? 0) : null

/**
 * Every project the viewer may see, newest first, with its client's name, how its tasks stand and
 * its link. Two grouped queries cover every project's counts, never one query per project.
 */
export async function listAllProjects(viewer: Viewer): Promise<ClientProjectsPage> {
  await connectDatabase()
  const scope = visibleTo(viewer)
  const [records, clients] = await Promise.all([
    ClientProjectModel.find(scope).sort({ createdAt: -1, _id: -1 }).limit(MAX_CLIENT_PROJECTS * 20).lean() as unknown as Promise<StoredProject[]>,
    Client.find(scope, { name: 1 }).sort({ name: 1 }).lean() as unknown as Promise<{ _id: { toString: () => string }; name: string }[]>,
  ])
  const counts = await ClientProjectTaskModel.aggregate<{ _id: string; total: number; done: number }>([
    { $match: { ...scope, projectId: { $in: records.map((record) => record._id.toString()) } } },
    { $group: { _id: "$projectId", total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } } } },
  ])
  const byProject = new Map(counts.map((row) => [row._id, row]))
  const clientNames = new Map(clients.map((client) => [client._id.toString(), client.name]))

  return {
    projects: records.map((record) => {
      const id = record._id.toString()
      const count = byProject.get(id)
      return {
        id,
        clientId: record.clientId,
        // A project whose client has gone still reads, rather than disappearing without a word
        clientName: clientNames.get(record.clientId) ?? "Client removed",
        name: record.name,
        description: record.description ?? "",
        status: record.status as ClientProjectStatus,
        taskCount: count?.total ?? 0,
        doneCount: count?.done ?? 0,
        publicToken: publicProjectToken(record, id),
        createdAt: new Date(record.createdAt).toISOString(),
        updatedAt: new Date(record.updatedAt).toISOString(),
      }
    }),
    clients: clients.map((client) => ({ id: client._id.toString(), name: client.name })),
  }
}

/** One project with its client's name and its link, or null when it is gone or another account's. */
export async function getProjectWithTasks(viewer: Viewer, projectId: string): Promise<ProjectWithTasks | null> {
  const filter = visibleById(viewer, projectId)
  if (!filter) return null
  await connectDatabase()
  const record = (await ClientProjectModel.findOne(filter).lean()) as unknown as StoredProject | null
  if (!record) return null
  const [client, total, done] = await Promise.all([
    Client.findOne({ ...visibleTo(viewer), _id: record.clientId }, { name: 1 }).lean() as unknown as Promise<{ name: string } | null>,
    ClientProjectTaskModel.countDocuments({ ...visibleTo(viewer), projectId }),
    ClientProjectTaskModel.countDocuments({ ...visibleTo(viewer), projectId, status: "done" }),
  ])
  return {
    id: projectId,
    clientId: record.clientId,
    clientName: client?.name ?? "Client removed",
    name: record.name,
    description: record.description ?? "",
    status: record.status as ClientProjectStatus,
    taskCount: total,
    doneCount: done,
    publicToken: publicProjectToken(record, projectId),
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
  }
}

/**
 * Makes, replaces or turns off a project's read-only link. **Replace** bumps the version, which
 * stops every earlier link at once; **off** leaves the version where it is, so turning it on again
 * makes a link nobody has seen before. Null when the project is gone or another account's.
 */
export async function changeProjectLink(viewer: Viewer, projectId: string, action: "create" | "replace" | "disable"): Promise<{ publicToken: string | null } | null> {
  const filter = visibleById(viewer, projectId)
  if (!filter) return null
  await connectDatabase()
  const current = (await ClientProjectModel.findOne(filter).lean()) as unknown as StoredProject | null
  if (!current) return null
  const version = (current.publicLinkVersion ?? 0) + (action === "replace" ? 1 : 0)
  const changes = { publicLinkVersion: version, publicLinkActive: action !== "disable" }
  await ClientProjectModel.updateOne(filter, { $set: changes })
  return { publicToken: publicProjectToken(changes, projectId) }
}

/**
 * What a read-only link opens: the project, its client's name and its tasks, with their images and
 * voice notes signed for playing. Null for a token that doesn't name a project, doesn't match its
 * current version, or names a project whose link is off, so every refusal reads the same.
 *
 * It is read outside any account, so the tasks are read by the project itself rather than by a
 * viewer's scope: the signed token is the key, and it opens this one project and nothing else.
 */
export async function readPublicProject(token: string): Promise<PublicProject | null> {
  const read = readProjectLinkToken(token)
  if (!read) return null
  await connectDatabase()
  const record = (await ClientProjectModel.findById(read.projectId).lean()) as unknown as StoredProject | null
  if (!record?.publicLinkActive || !projectLinkMatches(read, record.publicLinkVersion ?? 0)) return null
  const [client, tasks] = await Promise.all([
    Client.findById(record.clientId, { name: 1 }).lean() as unknown as Promise<{ name: string } | null>,
    listProjectTasks({}, read.projectId),
  ])
  return {
    name: record.name,
    description: record.description ?? "",
    status: record.status as ClientProjectStatus,
    clientName: client?.name ?? "",
    tasks,
    updatedAt: new Date(record.updatedAt).toISOString(),
  }
}
