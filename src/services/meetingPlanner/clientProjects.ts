import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { escapeForSearch } from "@/lib/listQuery"
import { ClientProjectModel } from "@/models/ClientProject"
import { MeetingPlan as MeetingPlanModel } from "@/models/MeetingPlan"
import { Client as ClientModel } from "@/models/Client"
import { visibleById, visibleTo } from "@/services/auth/viewer"
import { isFeatureDisabled } from "@/lib/featureAccess"
import { CLIENTS_TOOL } from "@/constants/clients"
import { MEETING_PROJECT_MESSAGES, MEETING_PROJECT_PAGE_SIZE } from "@/constants/meetingPlanner"
import type { MeetingProject, MeetingProjectPage } from "@/types/meetingPlanner"
import type { Viewer } from "@/types/auth"

/**
 * The client projects a meeting may be connected to (`projectId` on `meeting_plans`). The projects
 * themselves are Clients Management's (`client_projects`); this module only reads them, names them
 * on a meeting and checks one before it is saved, exactly as Prompt Creator's picker does.
 *
 * A meeting keeps the project's id alone, and its name, client and status are read afresh with the
 * meeting, so a project renamed or moved on in Clients Management reads that way here at once.
 */

type StoredProject = { _id: { toString: () => string }; name: string; clientId: string; status: string }
type StoredClient = { _id: { toString: () => string }; name: string }

const PROJECT_FIELDS = { name: 1, clientId: 1, status: 1 } as const

const toProject = (record: StoredProject, clientNames: Map<string, string>): MeetingProject => ({
  id: record._id.toString(),
  name: record.name,
  clientId: record.clientId,
  // A project whose client has gone is named plainly rather than dropped
  clientName: clientNames.get(record.clientId) ?? "",
  status: record.status,
})

async function clientNamesOf(viewer: Viewer, clientIds: string[]): Promise<Map<string, string>> {
  if (clientIds.length === 0) return new Map()
  const clients = (await ClientModel.find({ ...visibleTo(viewer), _id: { $in: clientIds } }, { name: 1 }).lean()) as unknown as StoredClient[]
  return new Map(clients.map((client) => [client._id.toString(), client.name]))
}

export interface MeetingProjectQuery {
  search: string
  clientId: string
  status: string
  page: number
}

/**
 * One page of the viewer's projects, searched and filtered in the database so a page covers every
 * project rather than a window of them. The search matches the project's name or its client's,
 * since a meeting is as often remembered by who it is for as by what. Answers every client the
 * viewer has projects under too, for the client filter, whatever the filters say.
 */
export async function listMeetingProjects(viewer: Viewer, query: MeetingProjectQuery): Promise<MeetingProjectPage> {
  await connectDatabase()
  const scope = visibleTo(viewer)
  const search = query.search.trim()
  const filter: Record<string, unknown> = { ...scope }
  if (query.clientId) filter.clientId = query.clientId
  if (query.status) filter.status = query.status
  if (search) {
    const pattern = new RegExp(escapeForSearch(search), "i")
    const matchingClients = (await ClientModel.find({ ...scope, name: pattern }, { _id: 1 }).lean()) as unknown as StoredClient[]
    filter.$or = [{ name: pattern }, { clientId: { $in: matchingClients.map((client) => client._id.toString()) } }]
  }

  const [total, clientIds] = await Promise.all([ClientProjectModel.countDocuments(filter), ClientProjectModel.distinct("clientId", scope)])
  const totalPages = Math.max(1, Math.ceil(total / MEETING_PROJECT_PAGE_SIZE))
  // A page past the end is the last page, as every list here does
  const page = Math.min(Math.max(1, query.page), totalPages)
  const records = (await ClientProjectModel.find(filter, PROJECT_FIELDS)
    .sort({ name: 1, _id: 1 })
    .skip((page - 1) * MEETING_PROJECT_PAGE_SIZE)
    .limit(MEETING_PROJECT_PAGE_SIZE)
    .lean()) as unknown as StoredProject[]

  const names = await clientNamesOf(viewer, (clientIds as string[]).filter(Boolean))
  return {
    items: records.map((record) => toProject(record, names)),
    page,
    pageSize: MEETING_PROJECT_PAGE_SIZE,
    total,
    totalPages,
    clients: [...names].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
  }
}

/**
 * The projects named by a set of meetings, in one read, keyed by id. A project that has since been
 * deleted, or is not the viewer's, is simply missing, and the meeting reads as connected to nothing.
 */
export async function projectsByIds(viewer: Viewer, ids: (string | null | undefined)[]): Promise<Map<string, MeetingProject>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id) && /^[0-9a-f]{24}$/i.test(id ?? "")))]
  if (wanted.length === 0) return new Map()
  await connectDatabase()
  const records = (await ClientProjectModel.find({ ...visibleTo(viewer), _id: { $in: wanted } }, PROJECT_FIELDS).lean()) as unknown as StoredProject[]
  const names = await clientNamesOf(viewer, [...new Set(records.map((record) => record.clientId))])
  return new Map(records.map((record) => [record._id.toString(), toProject(record, names)]))
}

/**
 * Checks a project before a meeting is connected to it: null passes (it disconnects), and an id
 * that names a project which is gone or another account's is refused, so a meeting is never quietly
 * connected to something the viewer cannot see.
 */
export async function assertConnectableProject(viewer: Viewer, projectId: string | null): Promise<MeetingProject | null> {
  if (!projectId) return null
  const filter = visibleById(viewer, projectId)
  if (!filter) throw new UserFacingError(MEETING_PROJECT_MESSAGES.notFound)
  await connectDatabase()
  const record = (await ClientProjectModel.findOne(filter, PROJECT_FIELDS).lean()) as unknown as StoredProject | null
  if (!record) throw new UserFacingError(MEETING_PROJECT_MESSAGES.notFound)
  return toProject(record, await clientNamesOf(viewer, [record.clientId]))
}

/**
 * What a create or an edit may save as the meeting's project: the id when it is the viewer's own,
 * null for none, and `false` when it names a project that is gone or another account's. With
 * Clients Management switched off for the account there are no projects to connect, so anything sent
 * is read as none rather than refused, the rule Prompt Creator's picker follows.
 */
export async function connectableProjectId(viewer: Viewer, projectId: string | null | undefined): Promise<string | null | false> {
  if (!projectId || isFeatureDisabled(viewer, CLIENTS_TOOL.id)) return null
  try {
    return (await assertConnectableProject(viewer, projectId))?.id ?? null
  } catch (error) {
    if (error instanceof UserFacingError) return false
    throw error
  }
}

/**
 * Projects that were deleted stop being named by any meeting: the meetings stay, connected to
 * nothing, the rule deleting a project already follows for the prompts written for it.
 */
export async function forgetProjects(viewer: Viewer, projectIds: string[]): Promise<void> {
  if (projectIds.length === 0) return
  await connectDatabase()
  await MeetingPlanModel.updateMany({ ...visibleTo(viewer), projectId: { $in: projectIds } }, { $set: { projectId: null } })
}
