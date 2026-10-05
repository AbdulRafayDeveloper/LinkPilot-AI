import { connectDatabase } from "@/lib/db"
import { ClientProjectModel, type IClientProject } from "@/models/ClientProject"
import { ClientProjectTaskModel } from "@/models/ClientProjectTask"
import { Client } from "@/models/Client"
import { MAX_CLIENT_PROJECTS } from "@/constants/clients"
import { projectItemKind, type ProjectItemKind } from "@/constants/clientProjectTasks"
import { emptyItemCounts, totalItems } from "@/lib/projectItems"
import { projectLinkToken, projectLinkMatches, readProjectLinkToken } from "@/lib/projectLink"
import { visibleById, visibleTo } from "@/services/auth/viewer"
import { listProjectTasks } from "./tasks"
import type { ClientProjectsPage, ProjectItemCount, ProjectWithTasks, PublicProject } from "@/types/clientProjectTasks"
import type { ClientProjectStatus } from "@/constants/clients"
import type { Viewer } from "@/types/auth"

/**
 * Every client's projects in one list, with each tab's items counted, and the link a project is
 * shared by.
 *
 * The projects themselves belong to Clients Management (`services/clients/projects.ts`), which is
 * still the only place they are added, renamed or removed; this reads them across every client and
 * owns only what this module adds: the items under them and the link.
 */

type StoredProject = IClientProject & { _id: { toString: () => string } }
type CountRow = { _id: { projectId: string; kind: string | null }; total: number; done: number }

/**
 * How each tab of each project stands, in **one** grouped query for every project named, never one
 * query per project. An item saved before the tabs existed has no `kind` and is counted as a
 * change, exactly as it is shown.
 */
async function countsByProject(scope: Record<string, unknown>, projectIds: readonly string[]): Promise<Map<string, Record<ProjectItemKind, ProjectItemCount>>> {
  const byProject = new Map<string, Record<ProjectItemKind, ProjectItemCount>>()
  if (projectIds.length === 0) return byProject
  const rows = await ClientProjectTaskModel.aggregate<CountRow>([
    { $match: { ...scope, projectId: { $in: [...projectIds] } } },
    {
      $group: {
        _id: { projectId: "$projectId", kind: "$kind" },
        total: { $sum: 1 },
        done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
      },
    },
  ])
  for (const row of rows) {
    const counts = byProject.get(row._id.projectId) ?? emptyItemCounts()
    const kind = projectItemKind(row._id.kind).id
    counts[kind] = { total: counts[kind].total + row.total, done: counts[kind].done + row.done }
    byProject.set(row._id.projectId, counts)
  }
  return byProject
}

/**
 * The token of a project's shared link, or null when it has none on. The page puts it after its own
 * origin, the way an employee's plan link is built, so nothing here has to know the address the app
 * is being read at.
 */
export const publicProjectToken = (project: Pick<IClientProject, "publicLinkActive" | "publicLinkVersion">, id: string): string | null =>
  project.publicLinkActive ? projectLinkToken(id, project.publicLinkVersion ?? 0) : null

/**
 * Every project the viewer may see, newest first, with its client's name, how each of its tabs
 * stands and its link.
 */
export async function listAllProjects(viewer: Viewer): Promise<ClientProjectsPage> {
  await connectDatabase()
  const scope = visibleTo(viewer)
  const [records, clients] = await Promise.all([
    ClientProjectModel.find(scope).sort({ createdAt: -1, _id: -1 }).limit(MAX_CLIENT_PROJECTS * 20).lean() as unknown as Promise<StoredProject[]>,
    Client.find(scope, { name: 1 }).sort({ name: 1 }).lean() as unknown as Promise<{ _id: { toString: () => string }; name: string }[]>,
  ])
  const byProject = await countsByProject(scope, records.map((record) => record._id.toString()))
  const clientNames = new Map(clients.map((client) => [client._id.toString(), client.name]))

  return {
    projects: records.map((record) => {
      const id = record._id.toString()
      const counts = byProject.get(id) ?? emptyItemCounts()
      const total = totalItems(counts)
      return {
        id,
        clientId: record.clientId,
        // A project whose client has gone still reads, rather than disappearing without a word
        clientName: clientNames.get(record.clientId) ?? "Client removed",
        name: record.name,
        description: record.description ?? "",
        status: record.status as ClientProjectStatus,
        taskCount: total.total,
        doneCount: total.done,
        counts,
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
  const [client, byProject] = await Promise.all([
    Client.findOne({ ...visibleTo(viewer), _id: record.clientId }, { name: 1 }).lean() as unknown as Promise<{ name: string } | null>,
    countsByProject(visibleTo(viewer), [projectId]),
  ])
  const counts = byProject.get(projectId) ?? emptyItemCounts()
  const total = totalItems(counts)
  return {
    id: projectId,
    clientId: record.clientId,
    clientName: client?.name ?? "Client removed",
    name: record.name,
    description: record.description ?? "",
    status: record.status as ClientProjectStatus,
    taskCount: total.total,
    doneCount: total.done,
    counts,
    publicToken: publicProjectToken(record, projectId),
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
  }
}

/**
 * Makes, replaces or turns off a project's shared link. **Replace** bumps the version, which stops
 * every earlier link at once; **off** leaves the version where it is, so turning it on again makes
 * a link nobody has seen before. Null when the project is gone or another account's.
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
 * The one project a shared link opens, or null for a token that doesn't name a project, doesn't
 * match that project's current version, or names a project whose link is off, so every refusal
 * reads the same whatever went wrong.
 *
 * **This is the only door the shared link has.** Reading and writing both go through it, so a token
 * can only ever reach the single project it was signed for, and turning the link off or replacing
 * it shuts the writes in the same breath as the reads.
 */
export async function projectFromToken(token: string): Promise<StoredProject | null> {
  const read = readProjectLinkToken(token)
  if (!read) return null
  await connectDatabase()
  const record = (await ClientProjectModel.findById(read.projectId).lean()) as unknown as StoredProject | null
  if (!record?.publicLinkActive || !projectLinkMatches(read, record.publicLinkVersion ?? 0)) return null
  return record
}

/**
 * What a shared link shows: the project, its client's name and every item under it, with their
 * images and voice notes signed for showing and playing.
 *
 * It is read outside any account, so the items are read by the project itself rather than by a
 * viewer's scope: the signed token is the key, and it opens this one project and nothing else.
 */
export async function readPublicProject(token: string): Promise<PublicProject | null> {
  const record = await projectFromToken(token)
  if (!record) return null
  const [client, tasks] = await Promise.all([
    Client.findById(record.clientId, { name: 1 }).lean() as unknown as Promise<{ name: string } | null>,
    listProjectTasks({}, record._id.toString()),
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
