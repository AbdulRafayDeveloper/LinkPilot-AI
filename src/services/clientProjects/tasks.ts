import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { ClientProjectModel, type IClientProject } from "@/models/ClientProject"
import { ClientProjectTaskModel, type IClientProjectTask } from "@/models/ClientProjectTask"
import { MAX_PROJECT_TASKS, PROJECT_TASK_MESSAGES } from "@/constants/clientProjectTasks"
import { visibleById, visibleTo } from "@/services/auth/viewer"
import { deleteTaskImages, taskImageView } from "@/services/taskImages"
import { deleteVoiceNotes, voiceNoteView } from "./voiceNotes"
import type { ProjectTask, ProjectTaskInput } from "@/types/clientProjectTasks"
import type { Viewer } from "@/types/auth"

/**
 * The tasks on a client project, in `client_project_tasks`.
 *
 * Every call names the project first and reads it through `visibleById`, so a project the viewer
 * may not see answers as no project at all and its tasks can never be reached. A task's images and
 * its voice note live in S3 and are named on the task by the ids the server made for them; a page
 * receives each with a short-lived link, never a key.
 */

type StoredTask = IClientProjectTask & { _id: { toString: () => string } }
type StoredProject = IClientProject & { _id: { toString: () => string } }

/** The project, or null when it is gone or belongs to another account. */
export async function projectOrNull(viewer: Viewer, projectId: string): Promise<StoredProject | null> {
  const filter = visibleById(viewer, projectId)
  if (!filter) return null
  await connectDatabase()
  return (await ClientProjectModel.findOne(filter).lean()) as unknown as StoredProject | null
}

/** One task with its links signed, ready for a page. */
async function toTask(record: StoredTask): Promise<ProjectTask> {
  const [images, voiceNote] = await Promise.all([
    Promise.all((record.images ?? []).map((image) => taskImageView(image))),
    voiceNoteView(record.voiceNote),
  ])
  return {
    id: record._id.toString(),
    projectId: record.projectId,
    content: record.content,
    description: record.description ?? "",
    // An image whose link couldn't be signed is left out rather than shown broken
    images: images.filter((image) => image !== null),
    voiceNote,
    status: record.status === "done" ? "done" : "open",
    position: record.position ?? 0,
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
  }
}

/** Every task of one project, in the order they are shown. The records are read by the caller's scope. */
export async function listProjectTasks(scope: Record<string, unknown>, projectId: string): Promise<ProjectTask[]> {
  await connectDatabase()
  const records = (await ClientProjectTaskModel.find({ ...scope, projectId })
    .sort({ position: 1, createdAt: 1, _id: 1 })
    .limit(MAX_PROJECT_TASKS)
    .lean()) as unknown as StoredTask[]
  return Promise.all(records.map(toTask))
}

/** The tasks of one project for a signed-in viewer. Null when the project is gone or another account's. */
export async function tasksOfProject(viewer: Viewer, projectId: string): Promise<ProjectTask[] | null> {
  const project = await projectOrNull(viewer, projectId)
  if (!project) return null
  return listProjectTasks(visibleTo(viewer), projectId)
}

const cleanInput = (input: ProjectTaskInput) => ({
  content: input.content.replace(/\s+/g, " ").trim(),
  description: input.description?.trim() ?? "",
  images: (input.images ?? []).map((image) => ({ assetId: image.assetId, contentType: image.contentType })),
  voiceNote: input.voiceNote ? { assetId: input.voiceNote.assetId, contentType: input.voiceNote.contentType, seconds: input.voiceNote.seconds } : null,
  status: input.status === "done" ? "done" : "open",
})

/** Adds one task to the end of a project's list. Null when the project is gone or another account's. */
export async function addProjectTask(viewer: Viewer, projectId: string, input: ProjectTaskInput): Promise<ProjectTask | null> {
  const project = await projectOrNull(viewer, projectId)
  if (!project) return null
  const scope = visibleTo(viewer)
  const count = await ClientProjectTaskModel.countDocuments({ ...scope, projectId })
  if (count >= MAX_PROJECT_TASKS) throw new UserFacingError(PROJECT_TASK_MESSAGES.tooManyTasks)
  const last = (await ClientProjectTaskModel.findOne({ ...scope, projectId }).sort({ position: -1 }).select({ position: 1 }).lean()) as { position?: number } | null
  const record = await ClientProjectTaskModel.create({
    ownerId: viewer.id,
    clientId: project.clientId,
    projectId,
    ...cleanInput(input),
    position: (last?.position ?? count - 1) + 1,
  })
  return toTask(record.toObject() as unknown as StoredTask)
}

/**
 * Changes one task. Only the fields sent are written, so ticking a task off never has to carry its
 * text, images and voice note back. An image or a voice note taken off here is deleted from storage
 * once the record no longer names it, because nothing else can ever point at it.
 */
export async function updateProjectTask(viewer: Viewer, projectId: string, taskId: string, input: Partial<ProjectTaskInput>): Promise<ProjectTask | null> {
  const filter = visibleById(viewer, taskId)
  if (!filter || !(await projectOrNull(viewer, projectId))) return null
  await connectDatabase()
  const current = (await ClientProjectTaskModel.findOne({ ...filter, projectId }).lean()) as unknown as StoredTask | null
  if (!current) return null

  const cleaned = cleanInput({ content: input.content ?? current.content, ...input })
  const changes: Record<string, unknown> = {}
  if (input.content !== undefined) changes.content = cleaned.content
  if (input.description !== undefined) changes.description = cleaned.description
  if (input.images !== undefined) changes.images = cleaned.images
  if (input.voiceNote !== undefined) changes.voiceNote = cleaned.voiceNote
  if (input.status !== undefined) changes.status = cleaned.status
  if (input.content !== undefined && !cleaned.content) throw new UserFacingError(PROJECT_TASK_MESSAGES.missingTask)

  const record = (await ClientProjectTaskModel.findOneAndUpdate({ ...filter, projectId }, { $set: changes }, { returnDocument: "after", runValidators: true }).lean()) as unknown as StoredTask | null
  if (!record) return null

  // What the task no longer names can go: the record is already saved, so an orphan is the worst case
  if (input.images !== undefined) {
    const kept = new Set(cleaned.images.map((image) => image.assetId))
    await deleteTaskImages((current.images ?? []).filter((image) => !kept.has(image.assetId)))
  }
  if (input.voiceNote !== undefined && current.voiceNote && current.voiceNote.assetId !== cleaned.voiceNote?.assetId) {
    await deleteVoiceNotes([current.voiceNote])
  }
  return toTask(record)
}

/** Removes one task, then its images and its voice note (the record goes first). */
export async function deleteProjectTask(viewer: Viewer, projectId: string, taskId: string): Promise<boolean> {
  const filter = visibleById(viewer, taskId)
  if (!filter || !(await projectOrNull(viewer, projectId))) return false
  await connectDatabase()
  const record = (await ClientProjectTaskModel.findOneAndDelete({ ...filter, projectId }).lean()) as unknown as StoredTask | null
  if (!record) return false
  await deleteTaskImages(record.images ?? [])
  await deleteVoiceNotes([record.voiceNote])
  return true
}

/**
 * Removes every task of the projects named, with their images and voice notes. Used when a project
 * or a whole client goes, so nothing is left pointing at a project that no longer exists.
 */
export async function deleteTasksOfProjects(scope: Record<string, unknown>, projectIds: readonly string[]): Promise<number> {
  if (projectIds.length === 0) return 0
  await connectDatabase()
  const records = (await ClientProjectTaskModel.find({ ...scope, projectId: { $in: [...projectIds] } }).lean()) as unknown as StoredTask[]
  if (records.length === 0) return 0
  const { deletedCount } = await ClientProjectTaskModel.deleteMany({ _id: { $in: records.map((record) => new mongoose.Types.ObjectId(record._id.toString())) } })
  await deleteTaskImages(records.flatMap((record) => record.images ?? []))
  await deleteVoiceNotes(records.map((record) => record.voiceNote))
  return deletedCount ?? 0
}
