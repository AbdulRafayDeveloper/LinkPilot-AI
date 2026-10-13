import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { ClientProjectModel, type IClientProject } from "@/models/ClientProject"
import { ClientProjectTaskModel, type IClientProjectTask } from "@/models/ClientProjectTask"
import {
  DEFAULT_PROJECT_ITEM_KIND,
  MAX_PROJECT_TASKS,
  PROJECT_ITEM_KINDS,
  PROJECT_TASK_MESSAGES,
  PUBLIC_ITEM_KIND_IDS,
  projectItemKind,
  type ProjectItemAuthor,
  type ProjectItemKind,
} from "@/constants/clientProjectTasks"
import { itemName, itemProblem, projectItemUrl } from "@/lib/projectItems"
import { visibleById, visibleTo } from "@/services/auth/viewer"
import { deleteTaskImages, taskImageView } from "@/services/taskImages"
import { deleteVoiceNotes, voiceNoteView } from "./voiceNotes"
import { deleteProjectFiles, projectFileView, storedProjectFile } from "./files"
import type { ProjectTask, ProjectTaskInput } from "@/types/clientProjectTasks"
import type { Viewer } from "@/types/auth"

/**
 * The items on a client project, in `client_project_tasks`: its changes, its ideas and its
 * discussion, which are one collection told apart by `kind`.
 *
 * Every call through a signed-in viewer names the project first and reads it with `visibleById`, so
 * a project the viewer may not see answers as no project at all and its items can never be reached.
 * The shared link writes through `publicTasks.ts`, which resolves its one project from the signed
 * token and then uses the same three core functions here, so both surfaces share one set of rules.
 *
 * An item's images and its voice note live in S3 and are named on the item by the ids the server
 * made for them; a page receives each with a short-lived link, never a key.
 */

type StoredTask = IClientProjectTask & { _id: { toString: () => string } }
type StoredProject = IClientProject & { _id: { toString: () => string } }

const ID_PATTERN = /^[0-9a-f]{24}$/

/**
 * One item by its id and nothing else. The shared link's writes use this: they are already held to
 * one project by the token, so there is no account to scope them by. A signed-in viewer's writes
 * use `visibleById` instead, which also checks the account.
 */
export const taskById = (taskId: string): Record<string, unknown> | null => (ID_PATTERN.test(taskId) ? { _id: taskId } : null)

/**
 * The kinds a shared link may ever reach. `null` is in the list because it matches a row with no
 * `kind` at all, which is every item saved before the tabs existed and reads as a change.
 *
 * It is a **filter rather than a check after the fact**: added to a read it leaves the owner's own
 * tabs out of the answer, and added to a write's filter it makes an id that names one of them match
 * nothing, so a client holding the link cannot read, change or delete a credential or a backup even
 * if they somehow learned its id.
 */
export const PUBLIC_KINDS_ONLY = { kind: { $in: [...PUBLIC_ITEM_KIND_IDS, null] } } as const

/** One item by its id, held to the tabs a shared link may reach. */
export const publicTaskById = (taskId: string): Record<string, unknown> | null =>
  ID_PATTERN.test(taskId) ? { _id: taskId, ...PUBLIC_KINDS_ONLY } : null

/** The project, or null when it is gone or belongs to another account. */
export async function projectOrNull(viewer: Viewer, projectId: string): Promise<StoredProject | null> {
  const filter = visibleById(viewer, projectId)
  if (!filter) return null
  await connectDatabase()
  return (await ClientProjectModel.findOne(filter).lean()) as unknown as StoredProject | null
}

/** One item with its links signed, ready for a page. */
async function toTask(record: StoredTask): Promise<ProjectTask> {
  const [images, files, voiceNote] = await Promise.all([
    Promise.all((record.images ?? []).map((image) => taskImageView(image))),
    Promise.all((record.files ?? []).map((file) => projectFileView(storedProjectFile(file)))),
    voiceNoteView(record.voiceNote),
  ])
  return {
    id: record._id.toString(),
    projectId: record.projectId,
    content: record.content,
    description: record.description ?? "",
    url: record.url ?? "",
    // An image or a file whose link couldn't be signed is left out rather than shown broken
    images: images.filter((image) => image !== null),
    files: files.filter((file) => file !== null),
    voiceNote,
    status: record.status === "done" ? "done" : "open",
    // An item saved before the tabs existed has no kind and reads as a change, the first tab
    kind: projectItemKind(record.kind).id,
    addedBy: record.addedBy === "client" ? "client" : "owner",
    position: record.position ?? 0,
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
  }
}

/**
 * Every item of one project, in the order they are shown. Both surfaces read all three tabs in one
 * answer and split them on the page, so switching tab costs no request. The records are read by the
 * caller's scope, and the ceiling is per tab, which is also how `MAX_PROJECT_TASKS` is enforced.
 */
export async function listProjectTasks(scope: Record<string, unknown>, projectId: string): Promise<ProjectTask[]> {
  await connectDatabase()
  const records = (await ClientProjectTaskModel.find({ ...scope, projectId })
    .sort({ position: 1, createdAt: 1, _id: 1 })
    // The ceiling is per tab, so a project's whole list is at most that many on each of them
    .limit(MAX_PROJECT_TASKS * PROJECT_ITEM_KINDS.length)
    .lean()) as unknown as StoredTask[]
  return Promise.all(records.map(toTask))
}

/** The items of one project for a signed-in viewer. Null when the project is gone or another account's. */
export async function tasksOfProject(viewer: Viewer, projectId: string): Promise<ProjectTask[] | null> {
  const project = await projectOrNull(viewer, projectId)
  if (!project) return null
  return listProjectTasks(visibleTo(viewer), projectId)
}

const cleanInput = (input: ProjectTaskInput, kind: ProjectItemKind) => ({
  // A document and a backup may be saved with nothing typed and take their file's own name
  content: itemName(kind, input.content, input.files ?? []),
  description: input.description?.trim() ?? "",
  url: projectItemUrl(input.url ?? ""),
  images: (input.images ?? []).map((image) => ({ assetId: image.assetId, contentType: image.contentType })),
  files: (input.files ?? []).map((file) => ({
    assetId: file.assetId,
    name: file.name,
    contentType: file.contentType,
    category: file.category,
    size: file.size,
  })),
  voiceNote: input.voiceNote ? { assetId: input.voiceNote.assetId, contentType: input.voiceNote.contentType, seconds: input.voiceNote.seconds } : null,
  status: input.status === "done" ? "done" : "open",
})

interface CreateOptions {
  // The project the item goes on, already read and already allowed
  project: StoredProject
  projectId: string
  // Whose list it joins. An item added from the shared link is the project owner's, like the project
  ownerId: string | null
  addedBy: ProjectItemAuthor
  // What counts towards the ceiling and the end of the list: the viewer's scope, or the project alone
  scope: Record<string, unknown>
}

/**
 * Adds one item to the end of its tab. The ceiling is counted per tab, so a long discussion never
 * stops a change being added, and it is what holds a shared link to a sane amount of writing.
 */
export async function createProjectTask({ project, projectId, ownerId, addedBy, scope }: CreateOptions, input: ProjectTaskInput): Promise<ProjectTask> {
  const kind: ProjectItemKind = input.kind ?? DEFAULT_PROJECT_ITEM_KIND
  // What this tab needs, asked again here: the schema asks it of a request, this asks it of the item
  const problem = itemProblem(kind, input)
  if (problem) throw new UserFacingError(problem)
  await connectDatabase()
  const inTab = { ...scope, projectId, kind }
  const count = await ClientProjectTaskModel.countDocuments(inTab)
  if (count >= MAX_PROJECT_TASKS) throw new UserFacingError(PROJECT_TASK_MESSAGES.tooManyTasks)
  const last = (await ClientProjectTaskModel.findOne(inTab).sort({ position: -1 }).select({ position: 1 }).lean()) as { position?: number } | null
  const record = await ClientProjectTaskModel.create({
    ownerId,
    clientId: project.clientId,
    projectId,
    ...cleanInput(input, kind),
    kind,
    addedBy,
    position: (last?.position ?? count - 1) + 1,
  })
  return toTask(record.toObject() as unknown as StoredTask)
}

/**
 * Changes one item. Only the fields sent are written, so ticking an item off never has to carry its
 * text, images and voice note back. An image or a voice note taken off here is deleted from storage
 * once the record no longer names it, because nothing else can ever point at it.
 *
 * The filter decides who may change what: an account's own scope, or one project when the write
 * came from that project's shared link.
 */
export async function changeProjectTask(
  filter: Record<string, unknown>,
  projectId: string,
  input: Partial<ProjectTaskInput>
): Promise<ProjectTask | null> {
  await connectDatabase()
  const current = (await ClientProjectTaskModel.findOne({ ...filter, projectId }).lean()) as unknown as StoredTask | null
  if (!current) return null

  // The item as it would be once this change lands, which is what the tab's own rule is asked about
  const kind = projectItemKind(current.kind).id
  const merged: ProjectTaskInput = {
    content: input.content ?? current.content,
    description: input.description ?? current.description ?? "",
    url: input.url ?? current.url ?? "",
    files: input.files ?? (current.files ?? []).map(storedProjectFile),
    images: input.images ?? current.images ?? [],
    voiceNote: input.voiceNote !== undefined ? input.voiceNote : current.voiceNote,
    status: input.status,
  }
  const problem = itemProblem(kind, merged)
  if (problem) throw new UserFacingError(problem)

  const cleaned = cleanInput(merged, kind)
  const changes: Record<string, unknown> = {}
  // The name may change because the file did, so it is written whenever either of them is sent
  if (input.content !== undefined || input.files !== undefined) changes.content = cleaned.content
  if (input.description !== undefined) changes.description = cleaned.description
  if (input.url !== undefined) changes.url = cleaned.url
  if (input.images !== undefined) changes.images = cleaned.images
  if (input.files !== undefined) changes.files = cleaned.files
  if (input.voiceNote !== undefined) changes.voiceNote = cleaned.voiceNote
  if (input.status !== undefined) changes.status = cleaned.status

  const record = (await ClientProjectTaskModel.findOneAndUpdate({ ...filter, projectId }, { $set: changes }, { returnDocument: "after", runValidators: true }).lean()) as unknown as StoredTask | null
  if (!record) return null

  // What the item no longer names can go: the record is already saved, so an orphan is the worst case
  if (input.images !== undefined) {
    const kept = new Set(cleaned.images.map((image) => image.assetId))
    await deleteTaskImages((current.images ?? []).filter((image) => !kept.has(image.assetId)))
  }
  if (input.files !== undefined) {
    const kept = new Set(cleaned.files.map((file) => file.assetId))
    await deleteProjectFiles((current.files ?? []).filter((file) => !kept.has(file.assetId)).map(storedProjectFile))
  }
  if (input.voiceNote !== undefined && current.voiceNote && current.voiceNote.assetId !== cleaned.voiceNote?.assetId) {
    await deleteVoiceNotes([current.voiceNote])
  }
  return toTask(record)
}

/** Removes one item, then its images and its voice note (the record goes first). */
export async function removeProjectTask(filter: Record<string, unknown>, projectId: string): Promise<boolean> {
  await connectDatabase()
  const record = (await ClientProjectTaskModel.findOneAndDelete({ ...filter, projectId }).lean()) as unknown as StoredTask | null
  if (!record) return false
  await deleteTaskImages(record.images ?? [])
  await deleteProjectFiles((record.files ?? []).map(storedProjectFile))
  await deleteVoiceNotes([record.voiceNote])
  return true
}

/** Adds one item as the signed-in owner. Null when the project is gone or another account's. */
export async function addProjectTask(viewer: Viewer, projectId: string, input: ProjectTaskInput): Promise<ProjectTask | null> {
  const project = await projectOrNull(viewer, projectId)
  if (!project) return null
  return createProjectTask({ project, projectId, ownerId: viewer.dataOwnerId, addedBy: "owner", scope: visibleTo(viewer) }, input)
}

/** Changes one item as the signed-in owner. Null when the item or the project is out of reach. */
export async function updateProjectTask(viewer: Viewer, projectId: string, taskId: string, input: Partial<ProjectTaskInput>): Promise<ProjectTask | null> {
  const filter = visibleById(viewer, taskId)
  if (!filter || !(await projectOrNull(viewer, projectId))) return null
  return changeProjectTask(filter, projectId, input)
}

/** Removes one item as the signed-in owner. False when the item or the project is out of reach. */
export async function deleteProjectTask(viewer: Viewer, projectId: string, taskId: string): Promise<boolean> {
  const filter = visibleById(viewer, taskId)
  if (!filter || !(await projectOrNull(viewer, projectId))) return false
  return removeProjectTask(filter, projectId)
}

/**
 * Removes every item of the projects named, with their images and voice notes. Used when a project
 * or a whole client goes, so nothing is left pointing at a project that no longer exists.
 */
export async function deleteTasksOfProjects(scope: Record<string, unknown>, projectIds: readonly string[]): Promise<number> {
  if (projectIds.length === 0) return 0
  await connectDatabase()
  const records = (await ClientProjectTaskModel.find({ ...scope, projectId: { $in: [...projectIds] } }).lean()) as unknown as StoredTask[]
  if (records.length === 0) return 0
  const { deletedCount } = await ClientProjectTaskModel.deleteMany({ _id: { $in: records.map((record) => new mongoose.Types.ObjectId(record._id.toString())) } })
  await deleteTaskImages(records.flatMap((record) => record.images ?? []))
  await deleteProjectFiles(records.flatMap((record) => (record.files ?? []).map(storedProjectFile)))
  await deleteVoiceNotes(records.map((record) => record.voiceNote))
  return deletedCount ?? 0
}
