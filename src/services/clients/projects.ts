import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { ClientProjectModel, type IClientProject } from "@/models/ClientProject"
import { Client as ClientModel } from "@/models/Client"
import { CreatedPromptModel } from "@/models/CreatedPrompt"
import { CLIENT_PROJECT_MESSAGES, MAX_CLIENT_PROJECTS, countByStatus, isOpenProjectStatus } from "@/constants/clients"
import { visibleById, visibleTo } from "@/services/auth/viewer"
import { getClient } from "@/services/clientMessaging/clients"
import { deleteTasksOfProjects } from "@/services/clientProjects/tasks"
import { deleteProjectFileUploads } from "@/services/clientProjects/files"
import { deleteFoldersOfProjects } from "@/services/clientProjects/folders"
import { folderForProjectName, renameFolder } from "@/services/promptCreator/folders"
import { forgetProjects } from "@/services/meetingPlanner/clientProjects"
import type { ClientProject, ClientProjectInput, ClientProjectsPage, PromptProject } from "@/types/clients"
import type { Viewer } from "@/types/auth"

/**
 * The projects being done for a client, kept in the client_projects collection. A project belongs to
 * the account that added it, exactly like the client does: a user sees their own, an admin sees them
 * all. Every call names the client first, and a client the viewer may not see answers as no client at
 * all, so a project can never be read or written through someone else's client.
 *
 * **A project is also what a Prompt Creator prompt is written for**, at the owner's request: the
 * separate Projects module is gone, so this list is what the picker offers. Two things follow from
 * that, and both were the deleted module's behaviour, moved here rather than rewritten:
 *
 * - **Every project has a Prompt Creator folder with its name** (`folderId`), made with the project
 *   and renamed with it, so the prompts written for it are filed together without anyone moving
 *   them. The folder is an ordinary folder: it can be renamed, emptied or deleted, and a project
 *   whose folder is gone gets one again the next time a prompt is written for it
 *   (`ensureProjectFolder`), which is also how a project saved before this gets one.
 * - **Deleting a project frees its prompts rather than deleting them**: each goes back to no
 *   project, keeps whatever folder it is filed in, and the folder itself stays.
 */

type StoredProject = IClientProject & { _id: { toString: () => string } }

const toProject = (record: StoredProject): ClientProject => ({
  id: record._id.toString(),
  clientId: record.clientId,
  name: record.name,
  description: record.description ?? "",
  status: record.status,
  // Both missing on a project saved before it was what a prompt is written for
  promptInstructions: record.promptInstructions ?? "",
  folderId: record.folderId ?? null,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
})

/**
 * Only the fields the project owns, each trimmed. `promptInstructions` is written only when the
 * request carries it, so a caller written before projects had instructions never clears them.
 */
const cleanInput = ({ name, description, status, promptInstructions }: ClientProjectInput) => ({
  name: name.replace(/\s+/g, " ").trim(),
  description: description.trim(),
  status,
  ...(promptInstructions === undefined ? {} : { promptInstructions: promptInstructions.trim() }),
})

/**
 * The folder a project's prompts are filed in, made (or found by name) when it is missing, and
 * linked to the project so a later rename of either never loses it. Never throws: a prompt is still
 * saved, in no folder, if the folder cannot be had, because filing is a convenience and writing is
 * the job.
 */
export async function ensureProjectFolder(
  viewer: Viewer,
  project: Pick<ClientProject, "id" | "name" | "folderId">
): Promise<string | null> {
  try {
    const folderId = await folderForProjectName(viewer, project.name, project.folderId)
    if (folderId !== project.folderId) {
      await ClientProjectModel.updateOne(
        { ...visibleTo(viewer), _id: new mongoose.Types.ObjectId(project.id) },
        { $set: { folderId } }
      )
    }
    return folderId
  } catch (error: unknown) {
    console.error("Project folder Exception:", error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * The client a project belongs to, or null when the viewer may not see it. Every project call goes
 * through this first, so the client's own ownership rules decide who reaches its projects.
 */
async function clientOrNull(viewer: Viewer, clientId: string) {
  return getClient(viewer, clientId)
}

/**
 * A client's projects in the order they were dragged into (ties, from before ordering, newest first),
 * with how many stand at each status. Null when the client is gone.
 */
export async function listClientProjects(viewer: Viewer, clientId: string): Promise<ClientProjectsPage | null> {
  if (!(await clientOrNull(viewer, clientId))) return null
  await connectDatabase()
  const records = (await ClientProjectModel.find({ ...visibleTo(viewer), clientId })
    .sort({ position: 1, createdAt: -1, _id: -1 })
    .limit(MAX_CLIENT_PROJECTS)
    .lean()) as unknown as StoredProject[]
  const projects = records.map(toProject)
  return { projects, counts: countByStatus(projects.map((project) => project.status)) }
}

/** Adds a project to a client. Null when the client is gone; throws when the client is already full. */
export async function createClientProject(viewer: Viewer, clientId: string, input: ClientProjectInput): Promise<ClientProject | null> {
  if (!(await clientOrNull(viewer, clientId))) return null
  await connectDatabase()
  const held = await ClientProjectModel.countDocuments({ ...visibleTo(viewer), clientId })
  if (held >= MAX_CLIENT_PROJECTS) throw new UserFacingError(CLIENT_PROJECT_MESSAGES.tooMany)
  // A new project goes to the top of the list, above everything already dragged into place
  const top = (await ClientProjectModel.findOne({ ...visibleTo(viewer), clientId }, { position: 1 }).sort({ position: 1 }).lean()) as {
    position?: number
  } | null
  const position = top ? (top.position ?? 0) - 1 : 0
  const record = await ClientProjectModel.create({ ownerId: viewer.id, clientId, position, ...cleanInput(input) })
  const project = toProject(record as unknown as StoredProject)
  // Its Prompt Creator folder is made with it, so it shows among the folders straight away
  return { ...project, folderId: await ensureProjectFolder(viewer, project) }
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
  const before = (await ClientProjectModel.findOne({ ...filter, clientId }, { name: 1, folderId: 1 }).lean()) as unknown as
    | StoredProject
    | null
  const record = await ClientProjectModel.findOneAndUpdate({ ...filter, clientId }, cleanInput(input), {
    returnDocument: "after",
    runValidators: true,
  }).lean()
  if (!record) return null
  const project = toProject(record as unknown as StoredProject)
  /**
   * Its folder follows a new name. A folder that already has that name is left alone rather than
   * made into a second one, and a failure here never undoes the project's own rename.
   */
  if (before && project.folderId && project.name !== before.name) {
    await renameFolder(viewer, project.folderId, project.name).catch(() => null)
  }
  return project
}

/**
 * Puts one client's projects in the order they were dragged into, top to bottom. The order must name
 * every project of that client the viewer may see, each once: a tab that missed a project added or
 * deleted elsewhere is answered "changed" and reads the list again, rather than writing a partial
 * order over a whole one. Null when the client is gone. Sending the same order twice lands on the
 * same order.
 */
export async function reorderClientProjects(
  viewer: Viewer,
  clientId: string,
  orderedIds: string[]
): Promise<"saved" | "changed" | null> {
  if (!(await clientOrNull(viewer, clientId))) return null
  await connectDatabase()
  const held = await ClientProjectModel.find({ ...visibleTo(viewer), clientId }, { _id: 1 }).lean()
  const ids = new Set(held.map((record) => String(record._id)))
  if (ids.size !== orderedIds.length || orderedIds.some((id) => !ids.has(id))) return "changed"
  await ClientProjectModel.bulkWrite(
    orderedIds.map((id, position) => ({
      updateOne: { filter: { _id: new mongoose.Types.ObjectId(id), ...visibleTo(viewer), clientId }, update: { $set: { position } } },
    })),
    { ordered: false }
  )
  return "saved"
}

/** Removes one project. False when the client or the project is gone. */
export async function deleteClientProject(viewer: Viewer, clientId: string, projectId: string): Promise<boolean> {
  const filter = visibleById(viewer, projectId)
  if (!filter || !(await clientOrNull(viewer, clientId))) return false
  await connectDatabase()
  const { deletedCount } = await ClientProjectModel.deleteOne({ ...filter, clientId })
  // Its tasks go with it, with their images and voice notes, so nothing is left pointing at a
  // project that no longer exists (Client Projects owns those; this is the only place they leak from)
  if (deletedCount > 0) {
    await deleteTasksOfProjects(visibleTo(viewer), [projectId])
    // A file somebody was still uploading has no item to hang on, so its chunks go too
    await deleteProjectFileUploads(visibleTo(viewer), [projectId])
    // And the folders its documents were filed in, which file nothing now
    await deleteFoldersOfProjects([projectId])
    /**
     * The prompts written for it are **kept**, and go back to no project: a prompt is work of its
     * own, and the folder it is filed in stays as it is, so nothing the user wrote disappears with
     * the project.
     */
    await CreatedPromptModel.updateMany({ ...visibleTo(viewer), projectId }, { $set: { projectId: null } })
    // A meeting connected to it stays on the calendar, connected to nothing
    await forgetProjects(viewer, [projectId])
  }
  return deletedCount > 0
}

/**
 * Every project the viewer may write a prompt for, across all their clients, each with its client's
 * name and how many prompts have been written for it. Open projects first (everything but completed
 * and cancelled), then by client and project name, so the picker opens on the work in hand.
 */
export async function listPromptProjects(viewer: Viewer): Promise<PromptProject[]> {
  await connectDatabase()
  const scope = visibleTo(viewer)
  const [records, clients, counts] = await Promise.all([
    ClientProjectModel.find(scope, { clientId: 1, name: 1, status: 1, promptInstructions: 1, folderId: 1 })
      .limit(MAX_CLIENT_PROJECTS)
      .lean(),
    ClientModel.find(scope, { name: 1 }).lean(),
    CreatedPromptModel.aggregate<{ _id: string | null; count: number }>([
      { $match: { ...scope, projectId: { $ne: null } } },
      { $group: { _id: "$projectId", count: { $sum: 1 } } },
    ]),
  ])
  const clientNames = new Map<string, string>(
    (clients as unknown as { _id: { toString: () => string }; name: string }[]).map((client) => [client._id.toString(), client.name])
  )
  const byProject = new Map<string, number>(counts.map((row) => [String(row._id), row.count]))
  return (records as unknown as StoredProject[])
    .map((record) => ({
      id: record._id.toString(),
      name: record.name,
      clientId: record.clientId,
      // A project whose client has gone would be unreachable anyway, so it is named plainly
      clientName: clientNames.get(record.clientId) ?? "",
      status: record.status,
      instructions: record.promptInstructions ?? "",
      promptCount: byProject.get(record._id.toString()) ?? 0,
      folderId: record.folderId ?? null,
    }))
    .sort(
      (a, b) =>
        Number(!isOpenProjectStatus(a.status)) - Number(!isOpenProjectStatus(b.status)) ||
        a.clientName.localeCompare(b.clientName) ||
        a.name.localeCompare(b.name)
    )
}

/**
 * The project a prompt is being written for: the project itself when the viewer may use it, null
 * for none. Throws when the id names a project that is gone or another account's, so a prompt is
 * never quietly written for nothing when the user chose something.
 */
export async function projectForPrompt(viewer: Viewer, projectId: string | null): Promise<PromptProject | null> {
  if (!projectId) return null
  const filter = visibleById(viewer, projectId)
  if (!filter) throw new UserFacingError(CLIENT_PROJECT_MESSAGES.notFound)
  await connectDatabase()
  const record = (await ClientProjectModel.findOne(filter, {
    clientId: 1,
    name: 1,
    status: 1,
    promptInstructions: 1,
    folderId: 1,
  }).lean()) as unknown as StoredProject | null
  if (!record) throw new UserFacingError(CLIENT_PROJECT_MESSAGES.notFound)
  return {
    id: record._id.toString(),
    name: record.name,
    clientId: record.clientId,
    clientName: "",
    status: record.status,
    instructions: record.promptInstructions ?? "",
    promptCount: 0,
    folderId: record.folderId ?? null,
  }
}
